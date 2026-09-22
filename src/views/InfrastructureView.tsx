'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Server,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  Cpu,
  HardDrive,
  Terminal,
  Activity,
  Layers,
  Trash2,
  Edit2,
  ShieldCheck,
} from 'lucide-react';
import CreateHostModal from '@/components/CreateHostModal';
import { copyToClipboard } from '@/lib/utils';

interface HostedProject {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  runtimeType: string;
  port?: number;
  ports?: number[];
  containers?: any[];
  deployAutomation: string;
  containerName?: string;
}

interface Host {
  id: string;
  name: string;
  ipAddress?: string;
  sshAlias?: string;
  sshUser: string;
  sshPort: number;
  provider?: string;
  osType: string;
  specs?: string;
  prometheusJob?: string;
  status: string;
  notes?: string;
  opencodeEnabled?: number;
  opencodeHost?: string;
  opencodePort?: number | null;
  opencodeUseHttps?: number;
  opencodeUsername?: string;
  opencodePassword?: string;
  projectsCount: number;
  hostedProjects: HostedProject[];
  hasPortConflict: boolean;
  conflictedPorts: number[];
}

export interface InfrastructureViewProps {
  headerActionSlot?: React.ReactNode;
}

export default function InfrastructureView({ headerActionSlot }: InfrastructureViewProps) {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRestricted, setIsRestricted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchHosts = async () => {
    try {
      const res = await fetch('/api/hosts');
      if (res.status === 403) {
        setIsRestricted(true);
        return;
      }
      const data = await res.json();
      if (data.hosts) setHosts(data.hosts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHosts();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('create') === '1' || params.get('new') === '1') {
        setIsModalOpen(true);
      }
    }
  }, []);

  const handleCopySsh = async (text: string, id: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDeleteHost = async (host: Host) => {
    const count = host.hostedProjects?.length ?? host.projectsCount ?? 0;
    const firstConfirm = confirm(
      count > 0
        ? `На сервере "${host.name}" ${count} проект(а/ов). Удалить сервер из реестра? Проекты будут отвязаны (host станет пустым), но не удалены.`
        : 'Удалить этот сервер из реестра?'
    );
    if (!firstConfirm) return;
    try {
      const res = await fetch(`/api/hosts/${host.id}${count > 0 ? '?force=true' : ''}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        alert(data.error || 'Сервер нельзя удалить: на нем есть проекты. Отвяжите проекты от хоста в карточках проектов.');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Ошибка удаления сервера');
      fetchHosts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const totalPortsUsed = hosts.reduce(
    (acc, h) =>
      acc +
      (h.hostedProjects?.reduce(
        (pAcc, p) => pAcc + (p.ports?.length || (p.port ? 1 : 0)),
        0
      ) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Server className="w-7 h-7 text-indigo-400" /> Серверная инфраструктура
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Учет серверов, VPS, локальных машин, размещенных сервисов и контроль занятости портов.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {headerActionSlot}
          <button
            type="button"
            onClick={() => {
              setEditingHost(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Добавить сервер
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#0c121e] border border-slate-800">
          <div className="text-xs text-slate-400">Всего серверов</div>
          <div className="text-2xl font-bold text-white mt-1">{hosts.length}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#0c121e] border border-slate-800">
          <div className="text-xs text-slate-400">Статус Online</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {hosts.filter((h) => h.status === 'online').length}
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#0c121e] border border-slate-800">
          <div className="text-xs text-slate-400">Занято портов</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{totalPortsUsed}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#0c121e] border border-slate-800">
          <div className="text-xs text-slate-400">Конфликты портов</div>
          <div
            className={`text-2xl font-bold mt-1 ${
              hosts.some((h) => h.hasPortConflict) ? 'text-rose-400' : 'text-slate-400'
            }`}
          >
            {hosts.filter((h) => h.hasPortConflict).length}
          </div>
        </div>
      </div>

      {/* Host Cards */}
      {isRestricted ? (
        <div className="p-12 text-center rounded-2xl bg-[#0c121e] border border-amber-500/30">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Доступ ограничен</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            У вашей учетной записи (роль Viewer) нет прав на просмотр и управление серверной инфраструктурой.
          </p>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="p-6 rounded-2xl bg-[#0c121e] border border-slate-800/80 animate-pulse space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-800 rounded w-1/4" />
                  <div className="h-3 bg-slate-850 rounded w-1/3" />
                </div>
              </div>
              <div className="h-20 bg-slate-900/60 rounded-xl" />
            </div>
          ))}
        </div>
      ) : hosts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0c121e] border border-slate-800/80">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto mb-4">
            <Server className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Серверы не добавлены</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
            Добавьте ваш первый VPS или локальный сервер для мониторинга ресурсов, управления контейнерами и запуска OpenCode.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingHost(null);
              setIsModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-cyan-500/20 transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Добавить сервер
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {hosts.map((h) => {
            const sshCmd = h.sshAlias || (h.ipAddress ? `ssh ${h.sshUser}@${h.ipAddress} -p ${h.sshPort}` : '');

          return (
            <div
              key={h.id}
              className={`p-6 rounded-2xl bg-[#0c121e] border transition-all ${
                h.hasPortConflict
                  ? 'border-rose-500/50 shadow-lg shadow-rose-950/20'
                  : 'border-slate-800/80 hover:border-slate-700/80'
              }`}
            >
              {/* Host Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-white">{h.name}</h3>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          h.status === 'online'
                            ? 'bg-emerald-400 animate-pulse'
                            : h.status === 'degraded'
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`}
                      />
                      <span className="text-xs text-slate-400 font-mono">({h.provider || 'Self-hosted'})</span>
                      {h.opencodeEnabled ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                          OpenCode :{h.opencodePort || 4096}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-3 mt-1 font-mono">
                      <span>IP: {h.ipAddress || 'Не указан'}</span>
                      <span>•</span>
                      <span>ОС: {h.osType}</span>
                      {h.specs && (
                        <>
                          <span>•</span>
                          <span>{h.specs}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto">
                  {sshCmd && (
                    <button
                      type="button"
                      onClick={() => handleCopySsh(sshCmd, h.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-850 border border-slate-750 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
                      title="Скопировать команду SSH подключения"
                    >
                      {copiedId === h.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Скопировано!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{sshCmd}</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setEditingHost(h);
                      setIsModalOpen(true);
                    }}
                    className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Редактировать"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteHost(h)}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Port Conflict Alert */}
              {h.hasPortConflict && (
                <div className="my-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-bold text-rose-300">Конфликт портов на этом сервере!</div>
                    <div className="text-rose-200/80 mt-0.5">
                      Несколько сервисов претендуют на одинаковые сетевые порты:
                      <span className="font-mono font-bold ml-1 text-white">
                        {h.conflictedPorts.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Hosted Projects Table */}
              <div className="my-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Размещенные сервисы ({h.hostedProjects?.length || 0})</span>
                </div>

                {(!h.hostedProjects || h.hostedProjects.length === 0) ? (
                  <div className="text-xs text-slate-500 py-2 italic">На этом сервере пока не развернуто ни одного сервиса.</div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-500 border-b border-slate-800/80">
                      <tr>
                        <th className="pb-2 font-medium">Проект</th>
                        <th className="pb-2 font-medium">Рантайм</th>
                        <th className="pb-2 font-medium">Контейнеры & Порты</th>
                        <th className="pb-2 font-medium">Деплой</th>
                        <th className="pb-2 text-right font-medium">Действие</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {h.hostedProjects.map((p) => {
                        const hasConflict = p.ports?.some((port) => h.conflictedPorts.includes(port));

                        return (
                          <tr key={p.id} className="hover:bg-slate-900/30">
                            <td className="py-2.5">
                              <Link
                                href={`/projects/${p.id}`}
                                className="font-semibold text-slate-200 hover:text-cyan-400 flex items-center gap-1.5"
                              >
                                {p.title}
                              </Link>
                            </td>
                            <td className="py-2.5 font-mono text-[11px] text-slate-400">{p.runtimeType}</td>
                            <td className="py-2.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {p.containers && p.containers.length > 0 ? (
                                  p.containers.map((c: any, i: number) => {
                                    const isConflicted = c.port && h.conflictedPorts.includes(c.port);
                                    return (
                                      <span
                                        key={i}
                                        className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                                          isConflicted
                                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold'
                                            : 'bg-slate-900 text-slate-300 border-slate-750'
                                        }`}
                                      >
                                        {c.name || 'app'}: {c.port || 'no-port'} ({c.type || 'web'})
                                      </span>
                                    );
                                  })
                                ) : p.port ? (
                                  <span
                                    className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                                      hasConflict
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold'
                                        : 'bg-slate-900 text-slate-300 border-slate-750'
                                    }`}
                                  >
                                    :{p.port}
                                  </span>
                                ) : (
                                  <span className="text-slate-600 italic text-[11px]">нет портов</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 font-mono text-[11px] text-slate-400">{p.deployAutomation}</td>
                            <td className="py-2.5 text-right">
                              <Link
                                href={`/projects/${p.id}`}
                                className="text-cyan-400 hover:underline text-xs"
                              >
                                Открыть
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {h.notes && (
                <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/60 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">Заметки:</span> {h.notes}
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}

      {/* Modal */}
      <CreateHostModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingHost(null);
        }}
        onCreated={fetchHosts}
        initialHost={editingHost}
      />
    </div>
  );
}
