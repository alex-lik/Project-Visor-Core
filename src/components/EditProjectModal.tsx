'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Edit3 } from 'lucide-react';

/**
 * Редактирование базовых полей проекта: название, описание, сайт,
 * репозиторий, категория, приоритет и теги.
 * PATCH /api/projects/{id} — права проверяются на сервере (canUserEditProject).
 */
export default function EditProjectModal({
  project,
  isOpen,
  onClose,
  onSaved,
}: {
  project: any;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [category, setCategory] = useState('website');
  const [priority, setPriority] = useState('medium');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Заполняем форму актуальными значениями при каждом открытии
  useEffect(() => {
    if (isOpen && project) {
      setTitle(project.title || '');
      setDescription(project.description || '');
      setPublicUrl(project.publicUrl || '');
      setRepoUrl(project.repoUrl || '');
      setDocUrl(project.docUrl || '');
      setCategory(project.category || 'website');
      setPriority(project.priority || 'medium');
      setTagsInput(Array.isArray(project.tags) ? project.tags.join(', ') : '');
      setError('');
    }
  }, [isOpen, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Название проекта обязательно.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim(),
          publicUrl: publicUrl.trim() || null,
          repoUrl: repoUrl.trim() || null,
          docUrl: docUrl.trim() || null,
          category,
          priority,
          tags,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка при сохранении');

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputCls =
    'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm';
  const labelCls = 'block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Edit3 className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">Редактировать проект</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs font-mono">
              {error}
            </div>
          )}

          <div>
            <label className={labelCls}>Название *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название проекта"
              maxLength={120}
              className={inputCls}
              required
            />
          </div>

          <div>
            <label className={labelCls}>Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Что делает проект, для кого и зачем"
              rows={4}
              className={inputCls + ' resize-y'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Сайт (public URL)</label>
              <input
                type="text"
                value={publicUrl}
                onChange={(e) => setPublicUrl(e.target.value)}
                placeholder="https://example.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Репозиторий</label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Документация</label>
              <input
                type="text"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="https://docs.example.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Теги (через запятую)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="django, python, postgres"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Категория</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                <option value="website">🌐 Веб-сайт / Лендинг</option>
                <option value="saas">🚀 SaaS Платформа / Сервис</option>
                <option value="bot">🤖 Бот (Telegram/Discord)</option>
                <option value="crm">📊 CRM / Админка</option>
                <option value="api">🔌 REST API / Backend</option>
                <option value="script">⚙️ Скрипт / Парсер</option>
                <option value="system">🖥️ Системная служба</option>
                <option value="idea">💡 Идея / Исследование</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Приоритет</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
                <option value="critical">Критичный 🔥</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving ? 'Сохранение...' : <><Save className="w-4 h-4" /> Сохранить</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

