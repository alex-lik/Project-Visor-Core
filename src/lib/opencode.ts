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
 * Normalizes a user-entered host value: strips scheme, path, trailing slash and port.
 * Returns clean hostname plus any scheme/port explicitly embedded in the input.
 */
export function parseOpenCodeHostInput(
  raw?: string | null,
  fallback?: string | null
): { hostname: string; embeddedScheme?: 'http' | 'https'; embeddedPort?: number } {
  const source = (raw?.trim() || fallback?.trim() || '127.0.0.1').replace(/\/+$/, '');
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

export interface OpenCodeModelItem {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  fullId: string;
  isDefault?: boolean;
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
          modelsMap.set(fullId, {
            id: modelId,
            name: m.name || modelId,
            providerId: p.id,
            providerName: p.name || p.id,
            fullId,
            isDefault: isDef,
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
            modelsMap.set(fullId, {
              id: modelId,
              name: m.name || modelId,
              providerId: p.id,
              providerName: p.name || p.id,
              fullId,
              isDefault: isDef,
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
  options?: { model?: string; agent?: string; reasoningEffort?: string }
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
  if (options?.reasoningEffort && options.reasoningEffort !== 'none') {
    payload.reasoning = { effort: options.reasoningEffort };
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

  // Try 1: GET /session/:id/messages
  try {
    const res = await openCodeFetch(host, `/session/${sessionId}/messages`, {
      method: 'GET',
      headers,
      timeoutMs: 10000,
    });
    if (res.ok) {
      rawData = await res.json();
    }
  } catch {
    // Ignore and try fallback
  }

  // Try 2: GET /session/:id
  if (!rawData || !Array.isArray(rawData)) {
    try {
      const res = await openCodeFetch(host, `/session/${sessionId}`, {
        method: 'GET',
        headers,
        timeoutMs: 10000,
      });
      if (res.ok) {
        const sessionObj = await res.json();
        if (Array.isArray(sessionObj.messages)) {
          rawData = sessionObj.messages;
        } else if (sessionObj.parts || sessionObj.text) {
          rawData = [sessionObj];
        }
      }
    } catch {
      // Ignore
    }
  }

  if (!rawData || !Array.isArray(rawData)) {
    return null;
  }

  const assistantMessages = rawData.filter(
    (m: any) => m && (m.role === 'assistant' || m.sender === 'assistant' || m.author === 'assistant')
  );

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

  return {
    assistantText: assistantText.trim() || undefined,
    isGenerating: Boolean(lastAssistant.status === 'in_progress' || lastAssistant.status === 'running'),
    messagesCount: rawData.length,
    raw: rawData,
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

        for (let attempt = 1; attempt <= 3; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 4000));
          const sessionData = await fetchOpenCodeSessionMessages(host, sessionId);
          if (sessionData && sessionData.assistantText) {
            textResponse = sessionData.assistantText;
            recovered = true;
            console.log(`[OpenCode 524 Recovery] Successfully recovered assistant response on attempt ${attempt}!`);
            break;
          }
        }

        if (!recovered) {
          // Keep run as 'running' so user can click "Синхронизировать сессию"
          const pendingTime = Date.now();
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
