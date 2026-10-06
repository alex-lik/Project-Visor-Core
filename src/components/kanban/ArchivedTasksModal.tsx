'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Archive,
  RotateCcw,
  Trash2,
  Search,
  RefreshCw,
  Layers,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { KanbanTaskDetail, getPriorityConfig } from './TaskDetailModal';
import { formatDateTime } from '@/lib/utils';

export default function ArchivedTasksModal({
  isOpen,
  projectId,
  onClose,
  onTaskRestored,
  onTaskDeleted,
}: {
  isOpen: boolean;
  projectId?: string;
  onClose: () => void;
  onTaskRestored: () => void;
  onTaskDeleted: () => void;
}) {
  const [archivedTasks, setArchivedTasks] = useState<KanbanTaskDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchArchivedTasks = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('archived', 'only');
      if (projectId && projectId !== 'all') {
        q.set('projectId', projectId);
      }
      const res = await fetch(`/api/kanban/tasks?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setArchivedTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch archived tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchArchivedTasks();
    } else {
      setArchivedTasks([]);
      setSearchQuery('');
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleRestore = async (taskId: string) => {
    try {
      const res = await fetch(`/api/kanban/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: 0 }),
      });
      if (res.ok) {
        setArchivedTasks((prev) => prev.filter((t) => t.id !== taskId));
        onTaskRestored();
      }
    } catch (err) {
      console.error('Failed to restore task:', err);
    }
  };

  const handleDeletePermanent = async (taskId: string) => {
    if (!confirm('Удалить эту задачу навсегда? Это действие нельзя отменить.')) return;
    try {
      const res = await fetch(`/api/kanban/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        setArchivedTasks((prev) => prev.filter((t) => t.id !== taskId));
        onTaskDeleted();
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const filteredTasks = archivedTasks.filter((t) => {
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.projectTitle && t.projectTitle.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Архив задач Канбан</h2>
              <p className="text-xs text-slate-400">
                Задачи, скрытые с основной доски. Их можно восстановить или удалить навсегда.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/60 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по архивным задачам..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="button"
            onClick={fetchArchivedTasks}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
            title="Обновить список"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
              <span>Загрузка архива...</span>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2 font-mono">
              <Archive className="w-6 h-6 text-slate-600" />
              <span>В архиве нет задач</span>
            </div>
          ) : (
            filteredTasks.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/90 hover:border-slate-700 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {t.projectTitle && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-cyan-400 border border-slate-800">
                        {t.projectTitle}
                      </span>
                    )}
                    {(() => {
                      const pCfg = getPriorityConfig(t.priority);
                      return (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${pCfg.badge}`}>
                          {pCfg.label}
                        </span>
                      );
                    })()}
                    <span className="text-[10px] font-mono text-slate-400">
                      Колонка: {t.column}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Обновлена: {formatDateTime(t.updatedAt)}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-white truncate">{t.title}</h4>
                  {t.description && (
                    <p className="text-[11px] text-slate-400 line-clamp-1">{t.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRestore(t.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    title="Вернуть задачу на канбан-доску"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Восстановить</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeletePermanent(t.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Удалить навсегда"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
