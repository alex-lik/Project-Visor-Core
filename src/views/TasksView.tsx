'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Kanban,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  Trash2,
  ArrowRight,
  Sparkles,
  Bot,
  Globe,
  Layers,
  Terminal,
  Server,
  Lightbulb,
} from 'lucide-react';
import CreateTaskModal from '@/components/CreateTaskModal';
import { formatDateTime } from '@/lib/utils';

interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  column: string;
  priority: string;
  projectTitle: string;
  projectSlug: string;
  projectCategory: string;
  tags: string[];
  updatedAt: number;
}

interface ProjectOption {
  id: string;
  title: string;
}

export default function GlobalKanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchTasks = async () => {
    try {
      const url = selectedProjectId !== 'all' ? `/api/kanban/tasks?projectId=${selectedProjectId}` : '/api/kanban/tasks';
      const [taskRes, projRes] = await Promise.all([fetch(url), fetch('/api/projects')]);

      const taskData = await taskRes.json();
      const projData = await projRes.json();

      if (taskData.tasks) setTasks(taskData.tasks);
      if (projData.projects) setProjects(projData.projects);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [selectedProjectId]);

  const handleMoveTask = async (taskId: string, newColumn: string) => {
    try {
      await fetch(`/api/kanban/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column: newColumn }),
      });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Удалить эту задачу?')) return;
    try {
      await fetch(`/api/kanban/tasks/${taskId}`, { method: 'DELETE' });
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const columns = [
    { id: 'backlog', label: 'Бэклог', border: 'border-slate-800' },
    { id: 'todo', label: 'To Do (К выполнению)', border: 'border-amber-500/40' },
    { id: 'in_progress', label: 'В работе (In Progress)', border: 'border-cyan-500/40' },
    { id: 'review', label: 'Ревью / Тест', border: 'border-indigo-500/40' },
    { id: 'done', label: 'Выполнено (Done)', border: 'border-emerald-500/40' },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Kanban className="w-7 h-7 text-cyan-400" /> Единая Канбан-матрица
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Сквозная доска задач по всем проектам, чтобы держать приоритеты в одном месте и не терять фокус.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Project filter */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">Все проекты ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" /> Добавить задачу
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto min-w-[1000px] pb-6">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.column === col.id);
          return (
            <div key={col.id} className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <span className="text-xs font-bold font-mono uppercase text-slate-300 tracking-wide">
                  {col.label}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400">
                  {colTasks.length}
                </span>
              </div>

              <div className="space-y-3 flex-1 min-h-[450px]">
                {colTasks.length === 0 ? (
                  <div className="h-32 flex items-center justify-center border border-dashed border-slate-800/60 rounded-xl text-[11px] text-slate-600 font-mono">
                    Пусто
                  </div>
                ) : (
                  colTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/30 transition-all space-y-2.5 group shadow"
                    >
                      {/* Project origin chip */}
                      <div className="flex items-center justify-between gap-1">
                        <Link
                          href={`/projects/${t.projectId}`}
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-950 text-cyan-400 border border-slate-800 truncate max-w-[170px] hover:text-cyan-300"
                        >
                          {t.projectTitle}
                        </Link>
                        <button
                          onClick={() => handleDeleteTask(t.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-0.5"
                          title="Удалить задачу"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <h4 className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors leading-snug">
                        {t.title}
                      </h4>

                      {t.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{t.description}</p>
                      )}

                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            t.priority === 'urgent'
                              ? 'bg-rose-500/20 text-rose-400'
                              : t.priority === 'high'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {t.priority}
                        </span>

                        <select
                          value={t.column}
                          onChange={(e) => handleMoveTask(t.id, e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-300 focus:outline-none"
                        >
                          <option value="backlog">Бэклог</option>
                          <option value="todo">To Do</option>
                          <option value="in_progress">В работе</option>
                          <option value="review">Тест</option>
                          <option value="done">Готово</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <CreateTaskModal
        isOpen={isModalOpen}
        defaultProjectId={selectedProjectId !== 'all' ? selectedProjectId : undefined}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchTasks}
      />
    </div>
  );
}
