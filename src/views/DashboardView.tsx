'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Compass,
  FolderGit2,
  Server,
  Zap,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  ArrowUpRight,
  Activity,
  Globe,
  Terminal,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { STATUS_COLORS, formatDateTime } from '@/lib/utils';
import CreateProjectModal from '@/components/CreateProjectModal';
import CreateTaskModal from '@/components/CreateTaskModal';
import CreateHostModal from '@/components/CreateHostModal';
import OnboardingWizard from '@/components/OnboardingWizard';

interface ProjectItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  publicUrl?: string;
  repoUrl?: string;
  tags: string[];
  host?: { id: string; name: string; ip: string };
  taskStats: { total: number; inProgress: number; todo: number; done: number };
}

interface TaskItem {
  id: string;
  projectId: string;
  title: string;
  column: string;
  priority: string;
  projectTitle: string;
  projectCategory: string;
  updatedAt: number;
}

interface HostItem {
  id: string;
  name: string;
  ipAddress: string;
  provider: string;
  osType: string;
  specs: string;
  status: string;
  projectsCount: number;
  hasPortConflict: boolean;
  opencodeEnabled?: number;
}

interface ActivityItem {
  id: string;
  actorType: string;
  actorName: string;
  action: string;
  projectTitle?: string;
  details: string;
  createdAt: number;
}

export default function DashboardView() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [inProgressTasks, setInProgressTasks] = useState<TaskItem[]>([]);
  const [hosts, setHosts] = useState<HostItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isHostModalOpen, setIsHostModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const [projRes, taskRes, hostRes, actRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/kanban/tasks?column=in_progress'),
        fetch('/api/hosts'),
        fetch('/api/activity'),
      ]);

      const projData = await projRes.json();
      const taskData = await taskRes.json();
      const hostData = await hostRes.json();
      const actData = await actRes.json();

      if (projData.projects) setProjects(projData.projects);
      if (taskData.tasks) setInProgressTasks(taskData.tasks);
      if (hostData.hosts) setHosts(hostData.hosts);
      if (actData.logs) setActivities(actData.logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCompleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/kanban/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column: 'done' }),
      });
      setInProgressTasks((prev) => prev.filter((t) => t.id !== taskId));
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const onlineHosts = hosts.filter((h) => h.status === 'online').length;
  const opencodeHosts = hosts.filter((h) => h.opencodeEnabled).length;
  const portConflictsCount = hosts.filter((h) => h.hasPortConflict).length;

  return (
    <div className="space-y-8">
      {/* Onboarding Wizard */}
      <OnboardingWizard
        hostsCount={hosts.length}
        projectsCount={projects.length}
        opencodeHostsCount={opencodeHosts}
        onOpenCreateHost={() => setIsHostModalOpen(true)}
        onOpenCreateProject={() => setIsProjectModalOpen(true)}
      />

      {/* Top Banner & Quick Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Радар фокуса
          </h1>
          <p className="text-sm text-slate-400">
            Единый дашборд контроля проектов, активных задач и состояния инфраструктуры
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsTaskModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Новая задача</span>
          </button>

          <button
            type="button"
            onClick={() => setIsProjectModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-cyan-950/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить проект</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0c121e]/80 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Всего проектов</span>
            <FolderGit2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{projects.length}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>{projects.filter((p) => p.status === 'production').length} в продакшене</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c121e]/80 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">В работе (Фокус)</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-2">{inProgressTasks.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">активных задач прямо сейчас</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c121e]/80 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Серверы / Хосты</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {onlineHosts} <span className="text-xs font-normal text-slate-500">/ {hosts.length}</span>
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {hosts.length > 0 ? `${Math.round((onlineHosts / hosts.length) * 100)}% онлайн` : 'Нет хостов'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c121e]/80 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">OpenCode Хосты</span>
            <Terminal className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-300 mt-2">{opencodeHosts}</div>
          <div className="text-[11px] text-slate-500 mt-1">серверов с OpenCode</div>
        </div>
      </div>

      {/* Port Conflicts Warning Banner if any */}
      {portConflictsCount > 0 && (
        <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-rose-300">
                Обнаружены конфликты портов на {portConflictsCount} хосте(ах)!
              </div>
              <div className="text-xs text-rose-400/80">
                Несколько контейнеров используют одинаковые порты на одном сервере.
              </div>
            </div>
          </div>
          <Link
            href="/infrastructure"
            className="px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 text-xs font-medium border border-rose-500/40 transition-colors"
          >
            Проверить хосты
          </Link>
        </div>
      )}

      {/* Main Grid: Focus Radar Tasks + Infrastructure Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: In Progress Focus Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Задачи в фокусе</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/50">
                {inProgressTasks.length}
              </span>
            </div>
            <Link
              href="/tasks"
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              Все доски <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">Загрузка задач...</div>
          ) : inProgressTasks.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-slate-800 bg-[#0c121e]/40 text-center">
              <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-300">Нет активных задач в работе</div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Переместите задачу в колонку «В работе» на Канбан-доске проекта, и она появится здесь.
              </p>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(true)}
                className="mt-4 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Создать задачу
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {inProgressTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 rounded-xl border border-slate-800/80 bg-[#0c121e]/90 hover:border-slate-700 transition-all flex items-start justify-between gap-4 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Link
                        href={`/projects/${task.projectId}`}
                        className="text-[11px] font-mono font-medium text-cyan-400 hover:underline px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/30"
                      >
                        {task.projectTitle}
                      </Link>
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border ${
                          task.priority === 'critical'
                            ? 'bg-rose-950/60 text-rose-400 border-rose-800/50'
                            : task.priority === 'high'
                            ? 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>

                    <h4 className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors">
                      {task.title}
                    </h4>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(task.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCompleteTask(task.id)}
                    title="Завершить задачу"
                    className="p-2 rounded-lg bg-emerald-950/40 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-800/40 transition-all text-xs flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Hosts & Activity */}
        <div className="space-y-6">
          {/* Infrastructure Box */}
          <div className="p-5 rounded-2xl border border-slate-800/80 bg-[#0c121e]/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                Инфраструктура
              </h3>
              <Link
                href="/infrastructure"
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                Все <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {hosts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">Нет добавленных серверов</p>
            ) : (
              <div className="space-y-2.5">
                {hosts.slice(0, 4).map((host) => (
                  <div
                    key={host.id}
                    className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{host.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {host.ipAddress || 'Локальный хост'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {host.opencodeEnabled ? (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                          OpenCode
                        </span>
                      ) : null}
                      <span
                        className={`w-2 h-2 rounded-full ${
                          host.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Log Box */}
          <div className="p-5 rounded-2xl border border-slate-800/80 bg-[#0c121e]/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                События платформы
              </h3>
            </div>

            {activities.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">Пока нет записей аудита</p>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 5).map((act) => (
                  <div key={act.id} className="text-xs border-b border-slate-800/40 pb-2.5 last:border-0 last:pb-0">
                    <div className="text-slate-300 font-medium">{act.details}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                      <span>{act.actorName}</span>
                      <span>•</span>
                      <span>{formatDateTime(act.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onCreated={() => loadData()}
      />

      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onCreated={() => loadData()}
      />

      <CreateHostModal
        isOpen={isHostModalOpen}
        onClose={() => setIsHostModalOpen(false)}
        onCreated={() => loadData()}
      />
    </div>
  );
}
