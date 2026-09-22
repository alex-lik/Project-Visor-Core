'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Plus } from 'lucide-react';

interface ProjectOption {
  id: string;
  title: string;
}

export default function CreateTaskModal({
  isOpen,
  defaultProjectId,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  defaultProjectId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [column, setColumn] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (defaultProjectId) {
      setProjectId(defaultProjectId);
    }
  }, [defaultProjectId]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/projects')
        .then((r) => r.json())
        .then((d) => {
          if (d.projects) {
            setProjects(d.projects);
            if (!projectId && d.projects.length > 0) {
              setProjectId(d.projects[0].id);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Выберите проект');
      return;
    }

    setLoading(true);
    setError('');

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/kanban/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title,
          description,
          column,
          priority,
          tags,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка при создании задачи');

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <CheckSquare className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">Новая задача в Канбан</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs font-mono">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Проект</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={Boolean(defaultProjectId)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm disabled:opacity-60"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Название задачи <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="например: Оптимизировать SQL запрос отчетов"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Колонка</label>
              <select
                value={column}
                onChange={(e) => setColumn(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm"
              >
                <option value="backlog">📋 Бэклог</option>
                <option value="todo">🟡 К выполнению (To Do)</option>
                <option value="in_progress">⚡ В работе (In Progress)</option>
                <option value="review">🔍 Ревью / Тест</option>
                <option value="done">✅ Выполнено</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Приоритет</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm"
              >
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
                <option value="urgent">Срочно 🔥</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Описание / Контекст</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Детали задачи, ссылки на логи, шаги реализации..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Теги (через запятую)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="frontend, bug, auth"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-mono"
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
              {loading ? 'Создание...' : 'Добавить задачу'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
