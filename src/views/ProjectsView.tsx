'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FolderGit2,
  Plus,
  Search,
  Bot,
  Globe,
  Layers,
  Terminal,
  Cpu,
  Server,
  Lightbulb,
  ExternalLink,
  GitBranch,
  Filter,
  CheckCircle2,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { STATUS_COLORS, RUNTIME_LABELS, SECRETS_TYPE_LABELS } from '@/lib/utils';
import CreateProjectModal from '@/components/CreateProjectModal';

interface Project {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  repoUrl?: string;
  publicUrl?: string;
  tags: string[];
  host?: { id: string; name: string; ip: string };
  deployment?: {
    runtimeType: string;
    internalPort?: number;
    containerName?: string;
    containers?: any[];
    deployAutomation: string;
    secretsType?: string;
    secretsPathOrUri?: string;
  };
  taskStats: { total: number; inProgress: number; todo: number; done: number };
}

export interface ProjectsViewProps {
  actionSlot?: React.ReactNode;
}

export default function ProjectsView({ actionSlot }: ProjectsViewProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.projects) setProjects(data.projects);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const categories = [
    { id: 'all', label: 'Все проекты', icon: FolderGit2 },
    { id: 'website', label: 'Сайты', icon: Globe },
    { id: 'bot', label: 'Боты', icon: Bot },
    { id: 'saas', label: 'SaaS', icon: Cpu },
    { id: 'crm', label: 'CRM', icon: Layers },
    { id: 'script', label: 'Скрипты', icon: Terminal },
    { id: 'api', label: 'API', icon: Server },
    { id: 'idea', label: 'Идеи', icon: Lightbulb },
  ];

  const statuses = [
    { id: 'all', label: 'Все статусы' },
    { id: 'idea', label: 'Идея' },
    { id: 'backlog', label: 'Бэклог' },
    { id: 'in_dev', label: 'В разработке' },
    { id: 'staging', label: 'Staging' },
    { id: 'production', label: 'Production' },
    { id: 'paused', label: 'На паузе' },
    { id: 'archived', label: 'В архиве' },
  ];

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || p.priority === priorityFilter;

    return matchesSearch && matchesCategory && matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Проекты
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
              {projects.length}
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Реестр проектов, конфигурации деплоя и привязка к инфраструктуре
          </p>
        </div>

        <div className="flex items-center gap-2">
          {actionSlot}
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Добавить проект
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isSelected = categoryFilter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950'
                  : 'bg-[#0f172a] text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
              {cat.id !== 'all' && (
                <span className="text-[10px] opacity-60 font-mono">
                  ({projects.filter((p) => p.category === cat.id).length})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-[#0f172a] border border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, описанию или тегам..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-[#090d16] border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Фильтр по статусу проекта"
            className="px-3 py-1.5 rounded-lg bg-[#090d16] border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            aria-label="Фильтр по приоритету проекта"
            className="px-3 py-1.5 rounded-lg bg-[#090d16] border border-slate-700/80 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Все приоритеты</option>
            <option value="critical">Critical 🔥</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* View mode toggle */}
          <div className="flex items-center border border-slate-700/80 rounded-lg p-0.5 bg-[#090d16]">
            <button
              onClick={() => setViewMode('grid')}
              aria-label="Сетка проектов"
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              aria-label="Таблица проектов"
              className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-sm">Загрузка проектов...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-800 bg-[#0c121e]/40 text-center">
          <FolderGit2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <div className="text-base font-semibold text-slate-300">Проекты не найдены</div>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Попробуйте изменить параметры поиска или добавьте новый проект в систему.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const statusConfig = STATUS_COLORS[project.status] || {
              bg: 'bg-slate-800',
              border: 'border-slate-700',
              text: 'text-slate-300',
              label: project.status,
            };

            const containerCount =
              project.deployment?.containers && project.deployment.containers.length > 0
                ? project.deployment.containers.length
                : project.deployment?.containerName
                ? 1
                : 0;

            return (
              <div
                key={project.id}
                className="p-5 rounded-2xl border border-slate-800/80 bg-[#0c121e]/90 hover:border-slate-700/80 transition-all flex flex-col justify-between group shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                    >
                      {statusConfig.label}
                    </span>
                    <span className="text-[10px] font-mono uppercase text-slate-500 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                      {project.priority}
                    </span>
                  </div>

                  <Link href={`/projects/${project.id}`}>
                    <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
                      {project.title}
                    </h3>
                  </Link>

                  <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed min-h-[32px]">
                    {project.description || 'Описание отсутствует'}
                  </p>

                  {/* Infrastructure badge */}
                  <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <Server className="w-3.5 h-3.5 text-slate-500" />
                      <span>{project.host?.name || 'Без сервера'}</span>
                    </div>

                    {containerCount > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {containerCount} конт.
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                    <span>Задач: {project.taskStats.total}</span>
                    {project.taskStats.inProgress > 0 && (
                      <span className="text-amber-400">{project.taskStats.inProgress} в работе</span>
                    )}
                  </div>

                  <Link
                    href={`/projects/${project.id}`}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    Подробнее <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 overflow-hidden bg-[#0c121e]">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
              <tr>
                <th className="p-3">Проект</th>
                <th className="p-3">Категория</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Хост</th>
                <th className="p-3">Задачи</th>
                <th className="p-3 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((project) => {
                const statusConfig = STATUS_COLORS[project.status] || {
                  bg: 'bg-slate-800',
                  border: 'border-slate-700',
                  text: 'text-slate-300',
                  label: project.status,
                };
                return (
                  <tr key={project.id} className="hover:bg-slate-900/40">
                    <td className="p-3">
                      <Link href={`/projects/${project.id}`} className="font-semibold text-white hover:text-cyan-400">
                        {project.title}
                      </Link>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-400 uppercase">{project.category}</td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                      >
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-400">{project.host?.name || '—'}</td>
                    <td className="p-3 font-mono text-slate-400">
                      {project.taskStats.inProgress > 0 ? (
                        <span className="text-amber-400">{project.taskStats.inProgress} в работе</span>
                      ) : (
                        `${project.taskStats.total} всего`
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/projects/${project.id}`}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                      >
                        Перейти
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchProjects}
      />
    </div>
  );
}
