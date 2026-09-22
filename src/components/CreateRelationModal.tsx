'use client';

import React, { useState, useEffect } from 'react';
import { X, Network, Link as LinkIcon, Plus } from 'lucide-react';

interface ProjectOption {
  id: string;
  title: string;
}

export default function CreateRelationModal({
  isOpen,
  defaultSourceId,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  defaultSourceId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [sourceId, setSourceId] = useState(defaultSourceId || '');
  const [targetId, setTargetId] = useState('');
  const [relationType, setRelationType] = useState('depends_on');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (defaultSourceId) setSourceId(defaultSourceId);
  }, [defaultSourceId]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/projects')
        .then((r) => r.json())
        .then((d) => {
          if (d.projects) {
            setProjects(d.projects);
            if (!sourceId && d.projects.length > 0) setSourceId(d.projects[0].id);
            if (d.projects.length > 1 && !targetId) setTargetId(d.projects[1].id);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceId === targetId) {
      setError('Проект не может связываться с самим собой');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/relations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProjectId: sourceId,
          targetProjectId: targetId,
          relationType,
          description,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания связи');

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
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Network className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">Добавить связь между проектами</h2>
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
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Исходный сервис (Source)</label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Тип связи</label>
            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm"
            >
              <option value="depends_on">⚡ Зависит от сервиса</option>
              <option value="api_calls">🔌 Вызывает REST/gRPC API</option>
              <option value="database_shared">🗄️ Использует общую базу данных</option>
              <option value="webhook_events">📨 Отправляет вебхуки / события</option>
              <option value="auth_provider">🔐 Провайдер авторизации (OAuth/JWT)</option>
              <option value="submodule">📦 Подмодуль / библиотека</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Целевой сервис (Target)</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Описание взаимодействия</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="например: Бот передает лиды через POST /api/leads..."
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
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors"
            >
              {loading ? 'Создание...' : 'Сохранить связь'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
