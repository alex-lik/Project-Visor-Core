import { db } from '@/db';
import { opencodeRuns, activityLogs, hosts, Host, Project, OpencodeRun } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface OpenCodeHostConfig {
  opencodeHost?: string | null;
  ipAddress?: string | null;
  opencodePort?: number | null;
  opencodeUseHttps?: number | null;
  opencodeUsername?: string | null;
  opencodePassword?: string | null;
}

/**
 * Determines whether a hostname points to cloud metadata or link-local ranges (SSRF protection).
 */
export function isBlockedHost(hostname: string): boolean {
  const lower = (hostname || '').toLowerCase().trim();
  if (!lower) return false;
  // Cloud metadata services & well-known internal endpoints
  if (
    lower === '169.254.169.254' ||
    lower === 'metadata.google.internal' ||
    lower === 'metadata.internal' ||
    lower === '100.100.100.200' ||
    lower === 'instance-data'
  ) {
    return true;
  }
  // Link-local IPv4 169.254.0.0/16
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(lower)) {
    return true;
  }
  // IPv6 link-local fe80::/10
  if (lower.startsWith('fe80:')) {
    return true;
  }
  return false;
}

/**
 * Normalizes a user-entered host value: strips scheme, path, trailing slash and port.
 * Returns clean hostname plus any scheme/port explicitly embedded in the input.
 */
export function parseOpenCodeHostInput(
  raw?: string | null,
  fallback?: string | null
): { hostname: string; embeddedScheme?: 'http' | 'https'; embeddedPort?: number } {
  const source = (raw?.trim() || fallback?.trim() || '127.0.0.1').replace(/\/+$/, '');

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(source) && !/^(https?):\/\//i.test(source)) {
    throw new Error('SSRF protection: only http and https protocols are supported');
  }

  let rest = source;
  let embeddedScheme: 'http' | 'https' | undefined;

  const schemeMatch = rest.match(/^(https?):\/\//i);
  if (schemeMatch) {
    embeddedScheme = schemeMatch[1].toLowerCase() as 'http' | 'https';
    rest = rest.slice(schemeMatch[0].length);
  }

  // Cut off any path/query
  rest = rest.split('/')[0].split('?')[0];

  // Extract explicit :port (supports host:port, ignores IPv6 brackets edge-cases simply)
  let embeddedPort: number | undefined;
  const portMatch = rest.match(/:(\d{1,5})$/);
  let hostname = rest;
  if (portMatch) {
    const p = Number(portMatch[1]);
    if (Number.isFinite(p) && p > 0 && p <= 65535) {
      embeddedPort = p;
      hostname = rest.slice(0, -portMatch[0].length);
    }
  }

  // Strip IPv6 brackets
  hostname = hostname.replace(/^\[(.*)\]$/, '$1').trim() || '127.0.0.1';

  return { hostname, embeddedScheme, embeddedPort };
}

/**
 * Normalizes a port value coming from UI/API into a nullable integer.
 * Empty string / null / undefined / NaN / <=0 → null (auto mode).
 */
export function normalizeOpenCodePortInput(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const p = Number(value);
  if (!Number.isFinite(p) || p <= 0 || p > 65535) return null;
  return Math.floor(p);
}

export interface OpenCodeCandidate {
  url: string;
  /** Explicit port, or null when implicit (443 for https / 80 for http) */
  port: number | null;
  useHttps: boolean;
}

function dedupeCandidates(list: OpenCodeCandidate[]): OpenCodeCandidate[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = c.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Builds the ordered list of base URLs to probe for an OpenCode Server instance.
 *
 * Rules (per product requirement):
 * - If a port is specified (opencodePort field OR embedded in host string),
 *   probe that port with BOTH http and https ("долбим в порт").
 * - If no port is specified (optional/empty), probe 443 (https) and 80 (http),
 *   plus legacy 4096 (http/https) as a fallback for older setups.
 * - "А там, где найдём апишку, там она и будет" — first healthy candidate wins.
 */
export function buildOpenCodeCandidates(host: OpenCodeHostConfig): OpenCodeCandidate[] {
  const parsed = parseOpenCodeHostInput(host.opencodeHost, host.ipAddress);

  const explicitPort =
    host.opencodePort && Number.isFinite(Number(host.opencodePort)) && Number(host.opencodePort) > 0
      ? Number(host.opencodePort)
      : parsed.embeddedPort;

  if (explicitPort) {
    const candidates: OpenCodeCandidate[] = [];
    // For 443 prefer https first, otherwise http first (4096/custom usually plain http).
    if (explicitPort === 443) {
      candidates.push(
        { url: `https://${parsed.hostname}:${explicitPort}`, port: explicitPort, useHttps: true },
        { url: `http://${parsed.hostname}:${explicitPort}`, port: explicitPort, useHttps: false }
      );
    } else {
      candidates.push(
        { url: `http://${parsed.hostname}:${explicitPort}`, port: explicitPort, useHttps: false },
        { url: `https://${parsed.hostname}:${explicitPort}`, port: explicitPort, useHttps: true }
      );
    }
    // If user embedded a scheme explicitly, try that scheme first.
    if (parsed.embeddedScheme === 'https') candidates.reverse();
    return dedupeCandidates(candidates);
  }

  // Auto mode: no port specified — try 443/https, 80/http, then legacy 4096.
  return dedupeCandidates([
    { url: `https://${parsed.hostname}`, port: null, useHttps: true },
    { url: `http://${parsed.hostname}`, port: null, useHttps: false },
    { url: `http://${parsed.hostname}:4096`, port: 4096, useHttps: false },
    { url: `https://${parsed.hostname}:4096`, port: 4096, useHttps: true },
  ]);
}

/**
 * Builds the base URL for an OpenCode Server instance (sync, backward compatible).
 * - port == null/undefined (auto mode) → URL without explicit port
 *   (relies on scheme default 443/80).
 * - otherwise → protocol://host:port as before.
 */
export function buildOpenCodeBaseUrl(host: OpenCodeHostConfig): string {
  const parsed = parseOpenCodeHostInput(host.opencodeHost, host.ipAddress);
  const useHttps = parsed.embeddedScheme
    ? parsed.embeddedScheme === 'https'
    : Boolean(host.opencodeUseHttps);
  const protocol = useHttps ? 'https' : 'http';
  const port =
    host.opencodePort && Number.isFinite(Number(host.opencodePort)) && Number(host.opencodePort) > 0
      ? Number(host.opencodePort)
      : parsed.embeddedPort ?? null;
  if (port == null) return `${protocol}://${parsed.hostname}`;
  return `${protocol}://${parsed.hostname}:${port}`;
}

/**
 * Human-readable endpoint label, correctly handling auto (null) port.
 */
export function formatOpenCodeEndpoint(host: OpenCodeHostConfig): string {
  const parsed = parseOpenCodeHostInput(host.opencodeHost, host.ipAddress);
  const useHttps = parsed.embeddedScheme
    ? parsed.embeddedScheme === 'https'
    : Boolean(host.opencodeUseHttps);
  const protocol = useHttps ? 'https' : 'http';
  const port =
    host.opencodePort && Number.isFinite(Number(host.opencodePort)) && Number(host.opencodePort) > 0
      ? Number(host.opencodePort)
      : parsed.embeddedPort ?? null;
  return port == null ? `${protocol}://${parsed.hostname}` : `${protocol}://${parsed.hostname}:${port}`;
}

/**
 * Builds HTTP headers including optional Basic Authentication
 */
export function buildOpenCodeHeaders(host: OpenCodeHostConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (host.opencodePassword) {
    const username = host.opencodeUsername || 'opencode';
    const auth = Buffer.from(`${username}:${host.opencodePassword}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  return headers;
}

async function probeOpenCodeHealth(
  baseUrl: string,
  headers: Record<string, string>,
  timeoutMs = 5000
): Promise<{ ok: boolean; version?: string; status?: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}/global/health`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        return { ok: false, status: res.status, error: `Server responded with status ${res.status} ${res.statusText}` };
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON but 2xx — treat as reachable without version
      }
      return { ok: true, version: data?.version || 'unknown', status: res.status };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: any) {
    return {
      ok: false,
      error: err?.name === 'AbortError' ? `Connection timed out (${Math.round(timeoutMs / 1000)}s)` : err?.message || 'Connection failed',
    };
  }
}

export interface OpenCodeDiscoveryResult {
  healthy: boolean;
  version?: string;
  /** Base URL where the API was found (without /global/health suffix) */
  url: string;
  /** Resolved port: explicit number, or null when found on implicit 443/80 */
  detectedPort: number | null;
  detectedUseHttps: boolean;
  /** All probed base URLs in order */
  attempted: string[];
  error?: string;
}

/**
 * Auto-discovers the OpenCode Server endpoint:
 * - explicit port → probe http+https on that port;
 * - auto (no port) → probe https://host (443), http://host (80), then legacy 4096.
 * Returns the first healthy endpoint ("где найдём апишку — там она и будет").
 */
export async function discoverOpenCodeEndpoint(
  host: OpenCodeHostConfig,
  opts?: { timeoutMs?: number }
): Promise<OpenCodeDiscoveryResult> {
  let parsed;
  try {
    parsed = parseOpenCodeHostInput(host.opencodeHost, host.ipAddress);
  } catch (err: any) {
    return {
      healthy: false,
      url: host.opencodeHost || host.ipAddress || '',
      detectedPort: null,
      detectedUseHttps: false,
      attempted: [],
      error: err.message,
    };
  }

  if (isBlockedHost(parsed.hostname)) {
    return {
      healthy: false,
      url: `http://${parsed.hostname}`,
      detectedPort: null,
      detectedUseHttps: false,
      attempted: [],
      error: `SSRF protection: access to metadata/link-local address '${parsed.hostname}' is blocked`,
    };
  }

  const timeoutMs = opts?.timeoutMs ?? 5000;
  const headers = buildOpenCodeHeaders(host);
  const candidates = buildOpenCodeCandidates(host);
  const attempted = candidates.map((c) => c.url);
  const errors: string[] = [];

  for (const c of candidates) {
    const probe = await probeOpenCodeHealth(c.url, headers, timeoutMs);
    if (probe.ok) {
      return {
        healthy: true,
        version: probe.version,
        url: c.url,
        detectedPort: c.port,
        detectedUseHttps: c.useHttps,
        attempted,
      };
    }
    errors.push(`${c.url} → ${probe.error || `status ${probe.status}`}`);
  }

  return {
    healthy: false,
    url: candidates[0]?.url || buildOpenCodeBaseUrl(host),
    detectedPort: candidates[0]?.port ?? null,
    detectedUseHttps: candidates[0]?.useHttps ?? false,
    attempted,
    error: errors.length > 0 ? `API не найдена. Проверено: ${errors.join('; ')}` : 'Нет кандидатов для проверки',
  };
}

/**
 * Healthcheck with auto-discovery (backward-compatible shape + detected fields).
 */
export async function checkOpenCodeHealth(host: OpenCodeHostConfig): Promise<{
  healthy: boolean;
  version?: string;
  url: string;
  detectedPort?: number | null;
  detectedUseHttps?: boolean;
  attempted?: string[];
  error?: string;
}> {
  const found = await discoverOpenCodeEndpoint(host);
  if (found.healthy) {
    return {
      healthy: true,
      version: found.version,
      url: found.url,
      detectedPort: found.detectedPort,
      detectedUseHttps: found.detectedUseHttps,
      attempted: found.attempted,
    };
  }
  return {
    healthy: false,
    url: found.url,
    detectedPort: found.detectedPort,
    detectedUseHttps: found.detectedUseHttps,
    attempted: found.attempted,
    error: found.error,
  };
}

/**
 * Fetch wrapper resilient to a wrong stored scheme:
 * tries the primary base URL first, then the same host with flipped
 * http↔https scheme (same port) when the failure is network-level
 * (connection refused / TLS / timeout — i.e. fetch threw, no HTTP response).
 * HTTP responses (even 4xx/5xx) mean "server found" → no fallback.
 */
export async function openCodeFetch(
  host: OpenCodeHostConfig,
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const parsed = parseOpenCodeHostInput(host.opencodeHost, host.ipAddress);
  if (isBlockedHost(parsed.hostname)) {
    throw new Error(`SSRF protection: access to address '${parsed.hostname}' is blocked`);
  }

  const primary = `${buildOpenCodeBaseUrl(host)}${path}`;
  const timeoutMs = init?.timeoutMs ?? 30000;
  const { timeoutMs: _omit, ...fetchInit } = init || {};

  const doFetch = async (url: string): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...fetchInit, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    return await doFetch(primary);
  } catch (primaryErr: any) {
    // Only retry with flipped scheme when we never got an HTTP response.
    const candidates = buildOpenCodeCandidates(host);
    const primaryLower = primary.toLowerCase();
    const fallback = candidates.find((c) => !primaryLower.startsWith(c.url.toLowerCase()));
    if (!fallback) throw primaryErr;
    return await doFetch(`${fallback.url}${path}`);
  }
}

/**
 * Creates a new session on the OpenCode server
 */
export async function createOpenCodeSession(
  host: OpenCodeHostConfig,
  title?: string,
  directory?: string | null
): Promise<{ id: string; [key: string]: any }> {
  const body: any = { title: title || `Visor Task ${new Date().toLocaleTimeString()}` };
  // Рабочая директория проекта на удаленном хосте (иначе OpenCode стартует в своем cwd)
  if (directory && directory.trim().length > 0) {
    body.directory = directory.trim();
  }
  const res = await openCodeFetch(host, '/session', {
    method: 'POST',
    headers: buildOpenCodeHeaders(host),
    body: JSON.stringify(body),
    timeoutMs: 15000,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenCode session creation failed (${res.status}): ${text}`);
  }

  return await res.json();
}

/**
 * Lists active sessions on the OpenCode server
 */
export async function listOpenCodeSessions(
  host: OpenCodeHostConfig
): Promise<Array<{ id: string; title?: string; directory?: string; createdAt?: number | string; [key: string]: any }>> {
  try {
    const res = await openCodeFetch(host, '/session', {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 8000,
    });
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.sessions)) return data.sessions;
    return [];
  } catch (err) {
    console.warn(`[OpenCode] Failed to list sessions from host:`, err);
    return [];
  }
}

/**
 * Updates an OpenCode session (e.g. title) on the OpenCode server
 */
export async function updateOpenCodeSession(
  host: OpenCodeHostConfig,
  sessionId: string,
  update: { title?: string }
): Promise<any> {
  const res = await openCodeFetch(host, `/session/${sessionId}`, {
    method: 'PATCH',
    headers: buildOpenCodeHeaders(host),
    body: JSON.stringify(update),
    timeoutMs: 15000,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenCode session update failed (${res.status}): ${text}`);
  }

  return await res.json().catch(() => ({ success: true }));
}

/**
 * Deletes an OpenCode session permanently from the OpenCode server
 */
export async function deleteOpenCodeSession(
  host: OpenCodeHostConfig,
  sessionId: string
): Promise<boolean> {
  const res = await openCodeFetch(host, `/session/${sessionId}`, {
    method: 'DELETE',
    headers: buildOpenCodeHeaders(host),
    timeoutMs: 15000,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenCode session deletion failed (${res.status}): ${text}`);
  }

  return true;
}

/**
 * Gets a single session detail from OpenCode server
 */
export async function getOpenCodeSession(
  host: OpenCodeHostConfig,
  sessionId: string
): Promise<{ id: string; title?: string; directory?: string; model?: any; time?: any; [key: string]: any } | null> {
  try {
    const res = await openCodeFetch(host, `/session/${sessionId}`, {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 6000,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

/**
 * Aborts a running task/generation in an OpenCode session
 */
export async function abortOpenCodeSession(
  host: OpenCodeHostConfig,
  sessionId: string
): Promise<boolean> {
  try {
    const res = await openCodeFetch(host, `/session/${sessionId}/abort`, {
      method: 'POST',
      headers: buildOpenCodeHeaders(host),
      body: JSON.stringify({}),
      timeoutMs: 8000,
    });
    return res.ok;
  } catch (err) {
    console.warn(`[OpenCode] Failed to abort session ${sessionId}:`, err);
    return false;
  }
}

/**
 * Gets map of active session statuses (busy/idle) from OpenCode
 */
export async function getOpenCodeSessionStatuses(
  host: OpenCodeHostConfig
): Promise<Record<string, { type: 'busy' | 'idle' }>> {
  try {
    const res = await openCodeFetch(host, '/session/status', {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 5000,
    });
    if (!res.ok) return {};
    return await res.json();
  } catch (err) {
    return {};
  }
}

/**
 * Creates a new session by forking an existing session at a specific message
 */
export async function forkOpenCodeSession(
  host: OpenCodeHostConfig,
  sessionId: string,
  messageId?: string
): Promise<any> {
  const body: any = {};
  if (messageId) body.messageID = messageId;
  const res = await openCodeFetch(host, `/session/${sessionId}/fork`, {
    method: 'POST',
    headers: buildOpenCodeHeaders(host),
    body: JSON.stringify(body),
    timeoutMs: 12000,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenCode session fork failed (${res.status}): ${text}`);
  }
  return await res.json();
}

/**
 * Generates a public share link for an OpenCode session
 */
export async function shareOpenCodeSession(
  host: OpenCodeHostConfig,
  sessionId: string
): Promise<{ url?: string; [key: string]: any }> {
  const res = await openCodeFetch(host, `/session/${sessionId}/share`, {
    method: 'POST',
    headers: buildOpenCodeHeaders(host),
    body: JSON.stringify({}),
    timeoutMs: 12000,
  });
  if (!res.ok) {
    try {
      const sessionRes = await openCodeFetch(host, `/session/${sessionId}`, {
        method: 'GET',
        headers: buildOpenCodeHeaders(host),
        timeoutMs: 6000,
      });
      if (sessionRes.ok) {
        const sData = await sessionRes.json();
        if (sData.share?.url) {
          return sData.share;
        }
      }
    } catch {}
    const text = await res.text();
    throw new Error(`OpenCode session share failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.share || data;
}

/**
 * Revokes public share access for an OpenCode session
 */
export async function unshareOpenCodeSession(
  host: OpenCodeHostConfig,
  sessionId: string
): Promise<boolean> {
  const res = await openCodeFetch(host, `/session/${sessionId}/share`, {
    method: 'DELETE',
    headers: buildOpenCodeHeaders(host),
    timeoutMs: 10000,
  });
  return res.ok;
}

/**
 * Retrieves the AI-generated todo checklist for a session
 */
export async function getOpenCodeSessionTodo(
  host: OpenCodeHostConfig,
  sessionId: string
): Promise<Array<{ content: string; status: 'pending' | 'in_progress' | 'completed' | string; priority?: string }>> {
  try {
    const res = await openCodeFetch(host, `/session/${sessionId}/todo`, {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 6000,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

/**
 * Reverts a message/step in an OpenCode session
 */
export async function revertOpenCodeMessage(
  host: OpenCodeHostConfig,
  sessionId: string,
  messageId: string
): Promise<any> {
  const res = await openCodeFetch(host, `/session/${sessionId}/revert`, {
    method: 'POST',
    headers: buildOpenCodeHeaders(host),
    body: JSON.stringify({ messageID: messageId }),
    timeoutMs: 10000,
  });
  if (!res.ok) throw new Error(`Revert failed (${res.status})`);
  return await res.json();
}

/**
 * Restores reverted messages in an OpenCode session
 */
export async function unrevertOpenCodeSession(
  host: OpenCodeHostConfig,
  sessionId: string
): Promise<any> {
  const res = await openCodeFetch(host, `/session/${sessionId}/unrevert`, {
    method: 'POST',
    headers: buildOpenCodeHeaders(host),
    body: JSON.stringify({}),
    timeoutMs: 10000,
  });
  if (!res.ok) throw new Error(`Unrevert failed (${res.status})`);
  return await res.json();
}

/**
 * Runs a raw shell command in the context of an OpenCode session
 */
export async function executeOpenCodeSessionShell(
  host: OpenCodeHostConfig,
  sessionId: string,
  command: string,
  agent?: string
): Promise<any> {
  const res = await openCodeFetch(host, `/session/${sessionId}/shell`, {
    method: 'POST',
    headers: buildOpenCodeHeaders(host),
    body: JSON.stringify({ command, agent: agent || 'build' }),
    timeoutMs: 45000,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenCode shell command failed (${res.status}): ${text}`);
  }
  return await res.json();
}

/**
 * Lists available agents (e.g. build, plan, explore, general)
 */
export async function listOpenCodeAgents(
  host: OpenCodeHostConfig
): Promise<Array<{ name: string; description?: string; mode?: string; hidden?: boolean; [key: string]: any }>> {
  try {
    const res = await openCodeFetch(host, '/agent', {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 6000,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

/**
 * Lists available slash commands
 */
export async function listOpenCodeCommands(
  host: OpenCodeHostConfig
): Promise<Array<{ name: string; description?: string; [key: string]: any }>> {
  try {
    const res = await openCodeFetch(host, '/command', {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 6000,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

/**
 * Retrieves VCS / Git repository info
 */
export async function getOpenCodeVcs(
  host: OpenCodeHostConfig
): Promise<{ branch?: string; default_branch?: string; [key: string]: any } | null> {
  try {
    const res = await openCodeFetch(host, '/vcs', {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 6000,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

/**
 * Retrieves server directory paths
 */
export async function getOpenCodePath(
  host: OpenCodeHostConfig
): Promise<{ home?: string; state?: string; config?: string; worktree?: string; directory?: string; [key: string]: any } | null> {
  try {
    const res = await openCodeFetch(host, '/path', {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 6000,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

/**
 * Lists files and directories
 */
export async function listOpenCodeFiles(
  host: OpenCodeHostConfig,
  path?: string
): Promise<Array<{ name: string; path?: string; type: 'file' | 'directory'; size?: number; modified?: number }>> {
  try {
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    const res = await openCodeFetch(host, `/file${query}`, {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 10000,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

/**
 * Reads file content from the OpenCode host
 */
export async function getOpenCodeFileContent(
  host: OpenCodeHostConfig,
  path: string
): Promise<string | null> {
  try {
    const res = await openCodeFetch(host, `/file/content?path=${encodeURIComponent(path)}`, {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 15000,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    return null;
  }
}

/**
 * Finds files by name pattern
 */
export async function findOpenCodeFiles(
  host: OpenCodeHostConfig,
  query: string
): Promise<string[]> {
  try {
    const res = await openCodeFetch(host, `/find/file?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 10000,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

/**
 * Searches code content using server ripgrep
 */
export async function searchOpenCodeContent(
  host: OpenCodeHostConfig,
  pattern: string
): Promise<any[]> {
  try {
    const res = await openCodeFetch(host, `/find?pattern=${encodeURIComponent(pattern)}`, {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 15000,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

/**
 * Retrieves MCP server connections
 */
export async function getOpenCodeMcpStatus(host: OpenCodeHostConfig): Promise<any> {
  try {
    const res = await openCodeFetch(host, '/mcp', {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 6000,
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    return [];
  }
}

/**
 * Retrieves LSP server status
 */
export async function getOpenCodeLspStatus(host: OpenCodeHostConfig): Promise<any> {
  try {
    const res = await openCodeFetch(host, '/lsp', {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 6000,
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    return [];
  }
}

export interface OpenCodeModelItem {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  fullId: string;
  isDefault?: boolean;
  reasoning?: boolean;
  variants?: string[];
  defaultVariant?: string;
}

export interface OpenCodeModelsResult {
  models: OpenCodeModelItem[];
  defaultModel?: string;
  connectedProviders: string[];
}

/**
 * Fetches available AI models configured on the target OpenCode server.
 * Queries /config/providers (and falls back to /provider).
 */
export async function listOpenCodeModels(
  host: OpenCodeHostConfig
): Promise<OpenCodeModelsResult> {
  const modelsMap = new Map<string, OpenCodeModelItem>();
  const connectedProviders: string[] = [];
  let defaultModel: string | undefined = undefined;

  // 1. Primary: GET /config/providers
  try {
    const res = await openCodeFetch(host, '/config/providers', {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 8000,
    });
    if (res.ok) {
      const data = await res.json();
      const providers = Array.isArray(data?.providers) ? data.providers : [];
      const defaultMap = data?.default && typeof data.default === 'object' ? data.default : {};

      for (const p of providers) {
        if (!p || !p.id) continue;
        if (!connectedProviders.includes(p.id)) {
          connectedProviders.push(p.id);
        }
        const providerModels = p.models && typeof p.models === 'object' ? p.models : {};
        for (const [key, mObj] of Object.entries(providerModels)) {
          const m = (mObj && typeof mObj === 'object' ? mObj : {}) as any;
          const modelId = m.id || key;
          const fullId = `${p.id}/${modelId}`;
          const isDef = defaultMap[p.id] === modelId || defaultMap.default === fullId || defaultMap.default === modelId;
          const variants = m.variants && typeof m.variants === 'object'
            ? (Array.isArray(m.variants) ? m.variants : Object.keys(m.variants))
            : [];
          const hasReasoning = Boolean(m.capabilities?.reasoning || variants.length > 0);
          modelsMap.set(fullId, {
            id: modelId,
            name: m.name || modelId,
            providerId: p.id,
            providerName: p.name || p.id,
            fullId,
            isDefault: isDef,
            reasoning: hasReasoning,
            variants,
            defaultVariant: variants.includes('medium') ? 'medium' : variants[0] || undefined,
          });
          if (isDef && !defaultModel) {
            defaultModel = fullId;
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[OpenCode] Failed to fetch /config/providers:', err?.message);
  }

  // 2. Secondary fallback: GET /provider (only if no models found)
  if (modelsMap.size === 0) {
    try {
      const res = await openCodeFetch(host, '/provider', {
        method: 'GET',
        headers: buildOpenCodeHeaders(host),
        timeoutMs: 8000,
      });
      if (res.ok) {
        const data = await res.json();
        const connectedIds: string[] = Array.isArray(data?.connected) ? data.connected : [];
        const allProviders: any[] = Array.isArray(data?.all) ? data.all : [];
        const defaultMap = data?.default && typeof data.default === 'object' ? data.default : {};

        const activeProviders = allProviders.filter((p) => connectedIds.includes(p.id));
        for (const p of activeProviders) {
          if (!connectedProviders.includes(p.id)) {
            connectedProviders.push(p.id);
          }
          const providerModels = p.models && typeof p.models === 'object' ? p.models : {};
          for (const [key, mObj] of Object.entries(providerModels)) {
            const m = (mObj && typeof mObj === 'object' ? mObj : {}) as any;
            const modelId = m.id || key;
            const fullId = `${p.id}/${modelId}`;
            const isDef = defaultMap[p.id] === modelId;
            const variants = m.variants && typeof m.variants === 'object'
              ? (Array.isArray(m.variants) ? m.variants : Object.keys(m.variants))
              : [];
            const hasReasoning = Boolean(m.capabilities?.reasoning || variants.length > 0);
            modelsMap.set(fullId, {
              id: modelId,
              name: m.name || modelId,
              providerId: p.id,
              providerName: p.name || p.id,
              fullId,
              isDefault: isDef,
              reasoning: hasReasoning,
              variants,
              defaultVariant: variants.includes('medium') ? 'medium' : variants[0] || undefined,
            });
            if (isDef && !defaultModel) {
              defaultModel = fullId;
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[OpenCode] Failed to fetch /provider:', err?.message);
    }
  }

  const models = Array.from(modelsMap.values());
  // Sort models: default first, then by providerName, then by name
  models.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    if (a.providerName !== b.providerName) return a.providerName.localeCompare(b.providerName);
    return a.name.localeCompare(b.name);
  });

  if (!defaultModel && models.length > 0) {
    const def = models.find((m) => m.isDefault);
    defaultModel = def ? def.fullId : models[0].fullId;
  }

  return {
    models,
    defaultModel,
    connectedProviders,
  };
}

/**
 * Sends a message/prompt to an OpenCode session and extracts the assistant's answer
 */
export async function sendOpenCodePrompt(
  host: OpenCodeHostConfig,
  sessionId: string,
  prompt: string,
  options?: { model?: string; agent?: string; reasoningEffort?: string; variant?: string }
): Promise<{ textResponse: string; raw: any }> {
  const path = `/session/${sessionId}/message`;

  const payload: any = {
    parts: [
      {
        type: 'text',
        text: prompt,
      },
    ],
  };

  if (options?.model && options.model.trim().length > 0) {
    const trimmed = options.model.trim();
    const slashIdx = trimmed.indexOf('/');
    if (slashIdx > 0) {
      payload.model = {
        providerID: trimmed.slice(0, slashIdx),
        modelID: trimmed.slice(slashIdx + 1),
      };
    } else {
      payload.model = {
        providerID: 'opencode',
        modelID: trimmed,
      };
    }
  }
  if (options?.agent) payload.agent = options.agent;

  // OpenCode native reasoning variants: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  const rawVariant = options?.variant || options?.reasoningEffort;
  if (rawVariant && typeof rawVariant === 'string') {
    const v = rawVariant.trim().toLowerCase();
    if (v && v !== 'none' && v !== 'auto' && v !== 'default') {
      payload.variant = rawVariant.trim();
    }
  }

  let res: Response;
  try {
    res = await openCodeFetch(host, path, {
      method: 'POST',
      headers: buildOpenCodeHeaders(host),
      body: JSON.stringify(payload),
      // Генерация может длиться дольше Cloudflare-лимита 120с — ждём ответ/524.
      timeoutMs: 125000,
    });
  } catch (fetchErr: any) {
    throw new Error(`OpenCode connection failed: ${fetchErr.message}`);
  }

  if (!res.ok) {
    const text = await res.text();
    // Cloudflare 524 = origin не ответил за 120с (жесткий таймаут прокси Cloudflare).
    const is524 =
      res.status === 524 ||
      text.includes('524: A timeout occurred') ||
      text.includes('origin_response_timeout');

    if (is524) {
      const err = new Error(
        `OpenCode Cloudflare Timeout (524): Сервер не успел ответить за 120 секунд (жесткий лимит прокси Cloudflare). Процесс продолжает выполняться в фоне на сервере.`
      );
      (err as any).isCloudflare524 = true;
      (err as any).rawDetails = text;
      throw err;
    }
    throw new Error(`OpenCode message execution failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  // Extract text response from parts
  let textResponse = '';
  if (Array.isArray(data.parts)) {
    textResponse = data.parts
      .filter((p: any) => p && (p.type === 'text' || typeof p.text === 'string'))
      .map((p: any) => p.text || '')
      .join('\n\n');
  } else if (typeof data.text === 'string') {
    textResponse = data.text;
  } else {
    textResponse = JSON.stringify(data, null, 2);
  }

  return { textResponse, raw: data };
}

/**
 * Fetches session messages from OpenCode server.
 * Tries /session/:id/messages and fallback /session/:id.
 */
export async function fetchOpenCodeSessionMessages(
  host: OpenCodeHostConfig,
  sessionId: string
): Promise<{
  assistantText?: string;
  isGenerating?: boolean;
  messagesCount?: number;
  raw?: any;
} | null> {
  const headers = buildOpenCodeHeaders(host);

  let rawData: any = null;

  // OpenCode API:
  // Primary endpoint: GET /session/:id/message (OpenCode standard returns JSON array of messages)
  // Fallbacks: GET /api/session/:id/message, GET /session/:id
  const endpoints = [
    `/session/${sessionId}/message`,
    `/api/session/${sessionId}/message`,
    `/session/${sessionId}/messages`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await openCodeFetch(host, endpoint, {
        method: 'GET',
        headers,
        timeoutMs: 10000,
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        // If server returns HTML (OpenCode SPA fallback on unknown route), ignore it
        if (ct.includes('text/html')) {
          continue;
        }
        const json = await res.json();
        if (Array.isArray(json)) {
          rawData = json;
          break;
        } else if (json && Array.isArray(json.messages)) {
          rawData = json.messages;
          break;
        }
      }
    } catch {
      // Ignore and try fallback
    }
  }

  // Fallback: GET /session/:id
  if (!rawData || !Array.isArray(rawData)) {
    try {
      const res = await openCodeFetch(host, `/session/${sessionId}`, {
        method: 'GET',
        headers,
        timeoutMs: 10000,
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('text/html')) {
          const sessionObj = await res.json();
          if (Array.isArray(sessionObj?.messages)) {
            rawData = sessionObj.messages;
          } else if (sessionObj?.parts || sessionObj?.text) {
            rawData = [sessionObj];
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  if (!rawData || !Array.isArray(rawData)) {
    return null;
  }

  // OpenCode messages store role in m.info.role (standard OpenCode) or m.role (flat/legacy)
  const assistantMessages = rawData.filter((m: any) => {
    if (!m) return false;
    const role = (m.info?.role || m.role || m.sender || m.author || '').toLowerCase();
    return role === 'assistant';
  });

  if (assistantMessages.length === 0) {
    return { messagesCount: rawData.length, isGenerating: true };
  }

  const lastAssistant = assistantMessages[assistantMessages.length - 1];
  let assistantText = '';

  if (Array.isArray(lastAssistant.parts)) {
    assistantText = lastAssistant.parts
      .filter((p: any) => p && (p.type === 'text' || typeof p.text === 'string'))
      .map((p: any) => p.text || '')
      .join('\n\n');
  } else if (typeof lastAssistant.text === 'string') {
    assistantText = lastAssistant.text;
  } else if (typeof lastAssistant.content === 'string') {
    assistantText = lastAssistant.content;
  } else if (typeof lastAssistant.message === 'string') {
    assistantText = lastAssistant.message;
  }

  const isGenerating = Boolean(
    (lastAssistant.info && lastAssistant.info.finish !== 'stop' && !lastAssistant.info.time?.completed) ||
    lastAssistant.status === 'in_progress' ||
    lastAssistant.status === 'running'
  );

  return {
    assistantText: assistantText.trim() || undefined,
    isGenerating,
    messagesCount: rawData.length,
    raw: rawData,
  };
}

export interface OpenCodeChatPart {
  id?: string;
  type: 'text' | 'reasoning' | 'tool' | 'step-start' | 'step-finish' | string;
  text?: string;
  tool?: string;
  callID?: string;
  state?: {
    status?: 'pending' | 'running' | 'completed' | 'error' | string;
    input?: any;
    output?: string;
    title?: string;
    error?: string;
    metadata?: any;
  };
  time?: {
    start?: number;
    end?: number;
  };
}

export interface OpenCodeChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  createdAt?: number;
  completedAt?: number;
  model?: string;
  provider?: string;
  variant?: string;
  finish?: string;
  isGenerating?: boolean;
  parts?: OpenCodeChatPart[];
  thinking?: string;
  tokens?: {
    total?: number;
    input?: number;
    output?: number;
    reasoning?: number;
  };
}

export interface OpenCodeSessionChatResult {
  sessionId: string;
  messages: OpenCodeChatMessage[];
  diff: string | null;
  isGenerating: boolean;
  assistantText?: string;
  model?: {
    id?: string;
    providerID?: string;
    variant?: string;
  };
  directory?: string;
  title?: string;
  raw?: any;
}

/**
 * Fetches structured chat dialogue history (all user and assistant messages) and git diff.
 */
export async function fetchOpenCodeSessionChat(
  host: OpenCodeHostConfig,
  sessionId: string
): Promise<OpenCodeSessionChatResult | null> {
  const [sessionData, sessionMeta, diff] = await Promise.all([
    fetchOpenCodeSessionMessages(host, sessionId),
    getOpenCodeSession(host, sessionId),
    getOpenCodeDiff(host, sessionId),
  ]);

  if (!sessionData) {
    return null;
  }

  const rawMessages: any[] = Array.isArray(sessionData.raw) ? sessionData.raw : [];
  const messages: OpenCodeChatMessage[] = [];
  let detectedModel = sessionMeta?.model || undefined;
  let hasRunningTool = false;

  for (const m of rawMessages) {
    if (!m) continue;
    const roleStr = (m.info?.role || m.role || m.sender || m.author || 'assistant').toLowerCase();
    const role: 'user' | 'assistant' | 'system' =
      roleStr === 'user' ? 'user' : roleStr === 'system' ? 'system' : 'assistant';

    let text = '';
    const parts: OpenCodeChatPart[] = [];
    let thinking = '';

    if (Array.isArray(m.parts)) {
      for (const p of m.parts) {
        if (!p) continue;
        if (p.type === 'reasoning') {
          const reasoningText = p.text || (typeof p.reasoning === 'string' ? p.reasoning : '');
          if (reasoningText) thinking += (thinking ? '\n\n' : '') + reasoningText;
          parts.push({
            id: p.id,
            type: 'reasoning',
            text: reasoningText,
            time: p.time,
          });
        } else if (p.type === 'tool' || p.tool) {
          const status = p.state?.status || p.status || 'completed';
          if (status === 'running' || status === 'pending') {
            hasRunningTool = true;
          }
          parts.push({
            id: p.id,
            type: 'tool',
            tool: p.tool || p.name,
            callID: p.callID,
            state: p.state || {
              status,
              input: p.input,
              output: p.output,
              title: p.title,
            },
            time: p.time,
          });
        } else if (p.type === 'text' || typeof p.text === 'string') {
          const pText = p.text || '';
          if (pText) text += (text ? '\n\n' : '') + pText;
          parts.push({
            id: p.id,
            type: 'text',
            text: pText,
            time: p.time,
          });
        } else if (p.type === 'step-start' || p.type === 'step-finish') {
          parts.push({
            id: p.id,
            type: p.type,
            time: p.time,
          });
        }
      }
    } else if (typeof m.text === 'string') {
      text = m.text;
    } else if (typeof m.content === 'string') {
      text = m.content;
    } else if (typeof m.message === 'string') {
      text = m.message;
    }

    const trimmedText = text.trim();
    const isGen = Boolean(
      (m.info && m.info.finish !== 'stop' && !m.info.time?.completed) ||
      m.status === 'in_progress' ||
      m.status === 'running' ||
      hasRunningTool
    );

    const msgModel = m.info?.modelID || m.modelID || (typeof m.info?.model === 'string' ? m.info.model : m.info?.model?.id);
    const msgProvider = m.info?.providerID || m.providerID || m.info?.model?.providerID;
    const msgVariant = m.info?.variant || m.variant || m.info?.model?.variant;

    if (msgModel && !detectedModel) {
      detectedModel = {
        id: msgModel,
        providerID: msgProvider || 'opencode',
        variant: msgVariant || 'default',
      };
    }

    if (trimmedText.length > 0 || isGen || parts.length > 0) {
      messages.push({
        id: m.info?.id || m.id || `msg_${Math.random().toString(36).slice(2, 9)}`,
        role,
        text: trimmedText,
        createdAt: m.info?.time?.created || m.time?.created || m.createdAt || undefined,
        completedAt: m.info?.time?.completed || m.time?.completed || m.completedAt || undefined,
        model: msgModel,
        provider: msgProvider,
        variant: msgVariant,
        finish: m.info?.finish || m.finish,
        isGenerating: isGen,
        parts: parts.length > 0 ? parts : undefined,
        thinking: thinking.trim() || undefined,
        tokens: m.info?.tokens || m.tokens || undefined,
      });
    }
  }

  const isOverallGenerating = Boolean(sessionData.isGenerating || hasRunningTool);

  return {
    sessionId,
    messages,
    diff,
    isGenerating: isOverallGenerating,
    assistantText: sessionData.assistantText,
    model: detectedModel,
    directory: sessionMeta?.directory || undefined,
    title: sessionMeta?.title || undefined,
    raw: sessionData.raw,
  };
}

/**
 * Synchronizes an existing run with the remote OpenCode session on the host.
 * Checks for assistant messages and diff.
 */
export async function syncOpenCodeRun(runId: string): Promise<{
  success: boolean;
  recovered: boolean;
  status: 'completed' | 'running' | 'failed';
  run?: OpencodeRun;
  message?: string;
  error?: string;
}> {
  const [run] = await db.select().from(opencodeRuns).where(eq(opencodeRuns.id, runId)).limit(1);
  if (!run) {
    return { success: false, recovered: false, status: 'failed', error: 'Запуск не найден' };
  }

  if (!run.sessionId) {
    return { success: false, recovered: false, status: 'failed', error: 'У этого запуска нет sessionId OpenCode' };
  }

  const [host] = await db.select().from(hosts).where(eq(hosts.id, run.hostId)).limit(1);
  if (!host) {
    return { success: false, recovered: false, status: 'failed', error: 'Хост запуска не найден' };
  }

  const sessionData = await fetchOpenCodeSessionMessages(host, run.sessionId);
  const diff = await getOpenCodeDiff(host, run.sessionId);

  if (sessionData && sessionData.assistantText) {
    const completedTime = Date.now();
    await db
      .update(opencodeRuns)
      .set({
        response: sessionData.assistantText,
        diff: diff || run.diff,
        status: 'completed',
        errorMessage: null,
        completedAt: run.completedAt || completedTime,
      })
      .where(eq(opencodeRuns.id, runId));

    const [updated] = await db.select().from(opencodeRuns).where(eq(opencodeRuns.id, runId));
    return {
      success: true,
      recovered: true,
      status: 'completed',
      run: updated,
      message: 'Ответ агента и изменения файлов успешно синхронизированы из OpenCode!',
    };
  }

  if (sessionData && sessionData.isGenerating) {
    await db
      .update(opencodeRuns)
      .set({ status: 'running' })
      .where(eq(opencodeRuns.id, runId));

    const [updated] = await db.select().from(opencodeRuns).where(eq(opencodeRuns.id, runId));
    return {
      success: true,
      recovered: false,
      status: 'running',
      run: updated,
      message: 'Сессия всё ещё генерирует ответ на сервере OpenCode. Попробуйте обновить через 30 секунд.',
    };
  }

  return {
    success: false,
    recovered: false,
    status: (run.status as any) || 'failed',
    message: 'Новых ответов в сессии OpenCode пока не обнаружено.',
  };
}

/**
 * Fetches Git diff produced by the session from /session/:id/diff
 */
export async function getOpenCodeDiff(
  host: OpenCodeHostConfig,
  sessionId: string
): Promise<string | null> {
  try {
    const res = await openCodeFetch(host, `/session/${sessionId}/diff`, {
      method: 'GET',
      headers: buildOpenCodeHeaders(host),
      timeoutMs: 10000,
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (typeof data === 'string') return data;
    if (Array.isArray(data) && data.length > 0) {
      // Format array of diff objects into unified diff string
      return data
        .map((item: any) => {
          if (item.patch) return item.patch;
          if (item.diff) return item.diff;
          if (item.path) return `--- ${item.path}\n+++ ${item.path}\n${item.hunks || ''}`;
          return JSON.stringify(item, null, 2);
        })
        .join('\n\n');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * High-level orchestration: Runs prompt through host's OpenCode server,
 * collects response and diff, and stores the run in opencode_runs table.
 */
export async function executeOpenCodeRun(params: {
  host: Host;
  project?: Project | null;
  prompt: string;
  title?: string;
  userId?: string | null;
  actorName?: string;
  existingSessionId?: string;
  directory?: string | null;
  model?: string;
  reasoningEffort?: string;
}): Promise<OpencodeRun> {
  const { host, project, prompt, title, userId, actorName = 'Visor User', existingSessionId, directory, model, reasoningEffort } = params;

  const runId = `ocr_${nanoid(16)}`;
  const startTime = Date.now();
  const hostUrl = buildOpenCodeBaseUrl(host);

  // 1. Insert initial pending run
  await db.insert(opencodeRuns).values({
    id: runId,
    hostId: host.id,
    projectId: project?.id || null,
    userId: userId || null,
    title: title || prompt.slice(0, 60),
    prompt,
    status: 'running',
    createdAt: startTime,
  });

  // sessionId выносим наружу, чтобы сохранить его даже при ошибке (524 и т.д.)
  let sessionId: string | undefined = existingSessionId;

  try {
    // 2. Create session on OpenCode Server (or reuse existing)
    if (!sessionId) {
      const session = await createOpenCodeSession(host, title || `Visor: ${project?.title || host.name}`, directory);
      sessionId = session.id;
    }

    // Сохраняем sessionId сразу, чтобы UI показывал сессию даже если prompt упадет по таймауту
    await db
      .update(opencodeRuns)
      .set({ sessionId })
      .where(eq(opencodeRuns.id, runId));

    // 3. Send Prompt (with Cloudflare 524 recovery)
    let textResponse = '';
    let raw: any = null;

    try {
      const promptResult = await sendOpenCodePrompt(host, sessionId, prompt, {
        model,
        reasoningEffort,
      });
      textResponse = promptResult.textResponse;
      raw = promptResult.raw;
    } catch (promptErr: any) {
      if (promptErr.isCloudflare524) {
        // Cloudflare 524: Origin did not respond in 120s, but OpenCode continues in background!
        console.log(`[OpenCode 524 Recovery] Cloudflare 524 detected for session ${sessionId}. Attempting recovery polling...`);
        let recovered = false;

        for (let attempt = 1; attempt <= 6; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          const sessionData = await fetchOpenCodeSessionMessages(host, sessionId);
          if (sessionData && sessionData.assistantText && !sessionData.isGenerating) {
            textResponse = sessionData.assistantText;
            recovered = true;
            console.log(`[OpenCode 524 Recovery] Successfully recovered assistant response on attempt ${attempt}!`);
            break;
          }
        }

        if (!recovered) {
          // Keep run as 'running' so user can click "Синхронизировать сессию" or auto-sync can pick it up
          const pendingTime = Date.now();
          const parsedHost = parseOpenCodeHostInput(host.opencodeHost, host.ipAddress);
          await db
            .update(opencodeRuns)
            .set({
              sessionId,
              status: 'running',
              errorMessage:
                'Таймаут Cloudflare (524): Время генерации ответа превысило 120 секунд (жесткий лимит прокси Cloudflare). Процесс продолжается в фоне на сервере. Нажмите «Синхронизировать сессию», когда ответ будет сформирован.',
              metadata: JSON.stringify({
                durationMs: pendingTime - startTime,
                hostName: host.name,
                hostUrl,
                hostDomain: parsedHost.hostname,
                directory: directory || null,
                projectTitle: project?.title || null,
                model: model || null,
                reasoningEffort: reasoningEffort || null,
                isCloudflare524: true,
                rawDetails: promptErr.rawDetails,
              }),
            })
            .where(eq(opencodeRuns.id, runId));

          const [runningRun] = await db.select().from(opencodeRuns).where(eq(opencodeRuns.id, runId));
          return runningRun;
        }
      } else {
        throw promptErr;
      }
    }

    // 4. Fetch Diff if any files were changed
    const diff = await getOpenCodeDiff(host, sessionId);

    const completedTime = Date.now();
    const durationMs = completedTime - startTime;

    // 5. Update Run in DB
    await db
      .update(opencodeRuns)
      .set({
        sessionId,
        response: textResponse,
        diff,
        status: 'completed',
        completedAt: completedTime,
        metadata: JSON.stringify({
          durationMs,
          hostName: host.name,
          hostUrl,
          directory: directory || null,
          projectTitle: project?.title || null,
          model: model || null,
          reasoningEffort: reasoningEffort || null,
        }),
      })
      .where(eq(opencodeRuns.id, runId));

    // 6. Record in activity audit log
    await db.insert(activityLogs).values({
      id: nanoid(),
      actorType: 'user',
      actorName,
      action: 'opencode_run_completed',
      projectId: project?.id || null,
      details: `OpenCode executed task on host "${host.name}": "${(title || prompt).slice(0, 80)}" (${(durationMs / 1000).toFixed(1)}s)`,
      createdAt: completedTime,
    });

    const [updatedRun] = await db.select().from(opencodeRuns).where(eq(opencodeRuns.id, runId));
    return updatedRun;
  } catch (err: any) {
    const failedTime = Date.now();
    await db
      .update(opencodeRuns)
      .set({
        sessionId: sessionId || null,
        status: 'failed',
        errorMessage: err.message || 'Unknown OpenCode execution error',
        completedAt: failedTime,
        metadata: JSON.stringify({
          durationMs: failedTime - startTime,
          hostName: host.name,
          hostUrl,
          directory: directory || null,
          projectTitle: project?.title || null,
          model: model || null,
          reasoningEffort: reasoningEffort || null,
        }),
      })
      .where(eq(opencodeRuns.id, runId));

    await db.insert(activityLogs).values({
      id: nanoid(),
      actorType: 'user',
      actorName,
      action: 'opencode_run_failed',
      projectId: project?.id || null,
      details: `OpenCode task failed on host "${host.name}": ${err.message}`,
      createdAt: failedTime,
    });

    const [failedRun] = await db.select().from(opencodeRuns).where(eq(opencodeRuns.id, runId));
    return failedRun;
  }
}
