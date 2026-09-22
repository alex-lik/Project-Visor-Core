'use client';

import React, { useState, useEffect } from 'react';
import { X, Server, Zap, Check, AlertTriangle, Activity } from 'lucide-react';

interface DiscoveredEndpoint {
  url: string;
  port: number | null;
  useHttps: boolean;
  version?: string;
}

interface HostData {
  id?: string;
  name?: string;
  ipAddress?: string | null;
  sshAlias?: string | null;
  sshUser?: string;
  sshPort?: number;
  provider?: string | null;
  osType?: string;
  specs?: string | null;
  prometheusJob?: string | null;
  notes?: string | null;
  opencodeEnabled?: number | boolean;
  opencodeHost?: string | null;
  opencodePort?: number | null;
  opencodeUseHttps?: number | boolean;
  opencodeUsername?: string | null;
  opencodePassword?: string | null;
}

export default function CreateHostModal({
  isOpen,
  onClose,
  onCreated,
  initialHost = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  initialHost?: HostData | null;
}) {
  const [name, setName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [sshAlias, setSshAlias] = useState('');
  const [sshUser, setSshUser] = useState('root');
  const [sshPort, setSshPort] = useState('22');
  const [provider, setProvider] = useState('Hetzner');
  const [osType, setOsType] = useState('Ubuntu 24.04 LTS');
  const [specs, setSpecs] = useState('4 vCPU / 8 GB RAM / 80 GB NVMe');
  const [prometheusJob, setPrometheusJob] = useState('');
  const [notes, setNotes] = useState('');

  // OpenCode fields (порт опционален: пусто = авто 443/80; галки HTTPS нет — схема определяется автопоиском)
  const [opencodeEnabled, setOpencodeEnabled] = useState(false);
  const [opencodeHost, setOpencodeHost] = useState('');
  const [opencodePort, setOpencodePort] = useState('');
  const [opencodeUsername, setOpencodeUsername] = useState('opencode');
  const [opencodePassword, setOpencodePassword] = useState('');

  // Connection test state + запомненный найденный endpoint ("где найдём апишку — там она и будет")
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    healthy: boolean;
    version?: string;
    url?: string;
    detectedPort?: number | null;
    detectedUseHttps?: boolean;
    attempted?: string[];
    error?: string;
  } | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredEndpoint | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialHost) {
      setName(initialHost.name || '');
      setIpAddress(initialHost.ipAddress || '');
      setSshAlias(initialHost.sshAlias || '');
      setSshUser(initialHost.sshUser || 'root');
      setSshPort(String(initialHost.sshPort || 22));
      setProvider(initialHost.provider || 'VPS');
      setOsType(initialHost.osType || 'Ubuntu 24.04 LTS');
      setSpecs(initialHost.specs || '');
      setPrometheusJob(initialHost.prometheusJob || '');
      setNotes(initialHost.notes || '');
      setOpencodeEnabled(Boolean(initialHost.opencodeEnabled));
      setOpencodeHost(initialHost.opencodeHost || '');
      // null/undefined → авто-режим (пустое поле); число → явный порт
      setOpencodePort(
        initialHost.opencodePort != null && Number.isFinite(Number(initialHost.opencodePort))
          ? String(initialHost.opencodePort)
          : ''
      );
      setOpencodeUsername(initialHost.opencodeUsername || 'opencode');
      setOpencodePassword(initialHost.opencodePassword || '');
      // Если в БД уже лежит resolved endpoint — показываем его как найденный
      if (initialHost.opencodeHost || initialHost.ipAddress) {
        const hostLabel = (initialHost.opencodeHost || initialHost.ipAddress || '').trim();
        const port = initialHost.opencodePort != null ? Number(initialHost.opencodePort) : null;
        const useHttps = Boolean(initialHost.opencodeUseHttps);
        if (hostLabel && port != null) {
          setDiscovered({
            url: `${useHttps ? 'https' : 'http'}://${hostLabel}:${port}`,
            port,
            useHttps,
          });
        } else {
          setDiscovered(null);
        }
      } else {
        setDiscovered(null);
      }
    } else {
      setName('');
      setIpAddress('');
      setSshAlias('');
      setSshUser('root');
      setSshPort('22');
      setProvider('Hetzner');
      setOsType('Ubuntu 24.04 LTS');
      setSpecs('4 vCPU / 8 GB RAM / 80 GB NVMe');
      setPrometheusJob('');
      setNotes('');
      setOpencodeEnabled(false);
      setOpencodeHost('');
      setOpencodePort('');
      setOpencodeUsername('opencode');
      setOpencodePassword('');
      setDiscovered(null);
    }
    setTestResult(null);
    setError('');
  }, [initialHost, isOpen]);

  if (!isOpen) return null;

  const buildDiscoveryPayload = () => {
    const trimmedPort = opencodePort.trim();
    return {
      opencodeHost: opencodeHost.trim() || ipAddress.trim() || '127.0.0.1',
      // Пустой порт → null → сервер выполнит авто-обнаружение (443/80, затем 4096)
      opencodePort: trimmedPort ? Number(trimmedPort) : null,
      opencodeUsername: opencodeUsername || 'opencode',
      opencodePassword: opencodePassword || null,
    };
  };

  const runDiscovery = async () => {
    const res = await fetch('/api/hosts/test/opencode/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildDiscoveryPayload()),
    });
    return (await res.json()) as {
      healthy: boolean;
      version?: string;
      url?: string;
      detectedPort?: number | null;
      detectedUseHttps?: boolean;
      attempted?: string[];
      error?: string;
    };
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await runDiscovery();
      setTestResult(data);
      if (data.healthy && data.url) {
        setDiscovered({
          url: data.url,
          port: data.detectedPort ?? null,
          useHttps: Boolean(data.detectedUseHttps),
          version: data.version,
        });
      } else {
        setDiscovered(null);
      }
    } catch (err: any) {
      setTestResult({ healthy: false, error: err.message });
      setDiscovered(null);
    } finally {
      setTesting(false);
    }
  };

  // Любое ручное изменение цели сбрасывает запомненный endpoint — нужен повторный поиск
  const handleOpencodeTargetChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setDiscovered(null);
    setTestResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Авто-поиск endpoint прямо при сохранении: если пользователь не нажимал
      // "Тест связи", пробуем найти апишку автоматически — где найдём, там она и будет.
      let endpoint = discovered;
      if (opencodeEnabled && !endpoint) {
        try {
          const data = await runDiscovery();
          setTestResult(data);
          if (data.healthy && data.url) {
            endpoint = {
              url: data.url,
              port: data.detectedPort ?? null,
              useHttps: Boolean(data.detectedUseHttps),
              version: data.version,
            };
            setDiscovered(endpoint);
          }
        } catch {
          // Не блокируем сохранение при недоступности сети — сохраним как есть (авто-режим)
        }
      }

      const trimmedPort = opencodePort.trim();
      const payload = {
        name,
        ipAddress: ipAddress || null,
        sshAlias: sshAlias || null,
        sshUser: sshUser || 'root',
        sshPort: Number(sshPort) || 22,
        provider: provider || 'VPS',
        osType: osType || 'Ubuntu 24.04',
        specs: specs || null,
        prometheusJob: prometheusJob || null,
        notes: notes || '',
        opencodeEnabled: opencodeEnabled ? 1 : 0,
        opencodeHost: opencodeHost.trim() || null,
        // Порт опционален: найденный при discovery → resolved, ручной → как введён, пусто → null (авто)
        opencodePort: endpoint ? endpoint.port : trimmedPort ? Number(trimmedPort) : null,
        opencodeUseHttps: endpoint ? (endpoint.useHttps ? 1 : 0) : 0,
        opencodeUsername: opencodeUsername || 'opencode',
        opencodePassword: opencodePassword || null,
      };

      const url = initialHost?.id ? `/api/hosts/${initialHost.id}` : '/api/hosts';
      const method = initialHost?.id ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка при сохранении хоста');

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Server className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">
              {initialHost ? 'Редактировать сервер' : 'Добавить сервер / VPS'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs font-mono">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Имя сервера <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="например: VPS-1 Production (Hetzner)"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">IP-адрес хоста</label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="95.217.14.82"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">SSH Alias (~/.ssh/config)</label>
              <input
                type="text"
                value={sshAlias}
                onChange={(e) => setSshAlias(e.target.value)}
                placeholder="hetzner-prod"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">SSH User / Port</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sshUser}
                  onChange={(e) => setSshUser(e.target.value)}
                  placeholder="root"
                  className="w-2/3 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-mono"
                />
                <input
                  type="number"
                  value={sshPort}
                  onChange={(e) => setSshPort(e.target.value)}
                  placeholder="22"
                  className="w-1/3 px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Провайдер</label>
              <input
                type="text"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Hetzner, Timeweb, AWS..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
              />
            </div>
          </div>

          {/* --- OpenCode Server Integration Box --- */}
          <div className="p-4 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 to-slate-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={opencodeEnabled}
                  onChange={(e) => setOpencodeEnabled(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  Интеграция OpenCode Server (opencode serve)
                </span>
              </label>

              {opencodeEnabled && (
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="text-[11px] font-mono px-3 py-1 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-colors flex items-center gap-1.5"
                >
                  <Activity className="w-3 h-3" />
                  {testing ? 'Проверка...' : 'Тест связи'}
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              Подключение к headless HTTP серверу OpenCode для автономного выполнения задач агентами над проектами этого узла.
            </p>

            {opencodeEnabled && (
              <div className="space-y-3 pt-2 border-t border-cyan-950/60">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-300 mb-1">Домен или IP (по умолчанию IP хоста)</label>
                    <input
                      type="text"
                      value={opencodeHost}
                      onChange={handleOpencodeTargetChange(setOpencodeHost)}
                      placeholder={ipAddress || '127.0.0.1'}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-200 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Порт <span className="text-slate-500">(опционально)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={opencodePort}
                      onChange={handleOpencodeTargetChange(setOpencodePort)}
                      placeholder="авто"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-200 text-xs font-mono"
                    />
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed text-slate-400">
                  Порт можно не указывать: тогда Visor автоматически проверит{' '}
                  <span className="font-mono text-slate-300">https://host (443)</span> и{' '}
                  <span className="font-mono text-slate-300">http://host (80)</span>.
                  Если порт указан — проверим <span className="font-mono text-slate-300">HTTP и HTTPS</span> на
                  этом порту. Где найдём API — тот endpoint и сохраним.
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Username (OPENCODE_SERVER_USERNAME)</label>
                    <input
                      type="text"
                      value={opencodeUsername}
                      onChange={(e) => {
                        setOpencodeUsername(e.target.value);
                        setDiscovered(null);
                      }}
                      placeholder="opencode"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Пароль (OPENCODE_SERVER_PASSWORD)</label>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={opencodePassword}
                      onChange={(e) => {
                        setOpencodePassword(e.target.value);
                        setDiscovered(null);
                      }}
                      placeholder="Пароль Basic Auth"
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 text-xs font-mono"
                    />
                  </div>
                </div>

                {discovered && (
                  <div className="p-2.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-xs font-mono text-cyan-200 flex items-center justify-between">
                    <span className="truncate">Найдено: {discovered.url}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDiscovered(null);
                        setTestResult(null);
                      }}
                      className="ml-2 shrink-0 text-[10px] text-slate-400 hover:text-white underline"
                      title="Сбросить найденный endpoint и искать заново"
                    >
                      сбросить
                    </button>
                  </div>
                )}

                {/* Test Result Indicator */}
                {testResult && (
                  <div
                    className={`p-2.5 rounded-lg border text-xs font-mono space-y-1 ${
                      testResult.healthy
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {testResult.healthy ? <Check className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
                        <span className="truncate">
                          {testResult.healthy
                            ? `Связь установлена! OpenCode v${testResult.version || 'unknown'}`
                            : `Ошибка: ${testResult.error || 'Недоступен'}`}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{testResult.healthy ? 'HTTP 200 OK' : 'Connect Failed'}</span>
                    </div>
                    {testResult.healthy && testResult.url && (
                      <div className="text-[11px] text-emerald-200/90 truncate">Endpoint: {testResult.url}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">ОС</label>
              <input
                type="text"
                value={osType}
                onChange={(e) => setOsType(e.target.value)}
                placeholder="Ubuntu 24.04 LTS"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Конфигурация (CPU/RAM)</label>
              <input
                type="text"
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
                placeholder="4 vCPU / 8 GB RAM"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Prometheus Job (Node Exporter)</label>
            <input
              type="text"
              value={prometheusJob}
              onChange={(e) => setPrometheusJob(e.target.value)}
              placeholder="node_vps1"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Заметки / Памятка</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Пути до логов, установленные пакеты, правила firewall..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-sm">
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors"
            >
              {loading ? 'Сохранение...' : initialHost ? 'Сохранить изменения' : 'Добавить сервер'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
