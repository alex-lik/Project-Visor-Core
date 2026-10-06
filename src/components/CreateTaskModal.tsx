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

  const [dueDate, setDueDate] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [assigneeName, setAssigneeName] = useState('');
  const [checklistText, setChecklistText] = useState('');

  const colors = [
    { id: 'sky', label: 'Небесный', class: 'bg-sky-500' },
    { id: 'emerald', label: 'Изумрудный', class: 'bg-emerald-500' },
    { id: 'indigo', label: 'Индиго', class: 'bg-indigo-500' },
    { id: 'purple', label: 'Фиолетовый', class: 'bg-purple-500' },
    { id: 'amber', label: 'Янтарный', class: 'bg-amber-500' },
    { id: 'orange', label: 'Оранжевый', class: 'bg-orange-500' },
    { id: 'rose', label: 'Красный', class: 'bg-rose-500' },
  ];

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

    // Build initial checklist if items provided
    const checklistItems = checklistText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text, idx) => ({
        id: `cli_${Date.now()}_${idx}`,
        text,
        completed: false,
      }));

    const checklists =
      checklistItems.length > 0
        ? [
            {
              id: `cl_${Date.now()}`,
              title: 'Чек-лист задачи',
              items: checklistItems,
            },
          ]
        : [];

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
          dueDate: dueDate ? new Date(dueDate).getTime() : null,
          color: color || null,
          assigneeName: assigneeName.trim() || null,
          checklists,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка при создании задачи');

      // Reset
      setTitle('');
      setDescription('');
      setPriority('medium');
      setTagsInput('');
      setDueDate('');
      setColor(null);
      setAssigneeName('');
      setChecklistText('');

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-auto">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <CheckSquare className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">Новая карточка в Канбан</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
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

          {/* Color Palette Cover */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Цвет обложки (Trello стиль)</label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setColor(null)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${
                  !color ? 'border-cyan-400 bg-cyan-950 text-cyan-300' : 'border-slate-800 text-slate-400'
                }`}
              >
                Без цвета
              </button>
              {colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`w-6 h-6 rounded-md ${c.class} transition-all ${
                    color === c.id ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Срок сдачи (Дедлайн)</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Исполнитель</label>
              <input
                type="text"
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                placeholder="Разработчик / Агент..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Описание / Контекст</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Детали задачи, ссылки на логи, шаги реализации..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
            />
          </div>

          {/* Quick Checklists items input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Подзадачи / Чек-лист (каждый пункт с новой строки)
            </label>
            <textarea
              rows={2}
              value={checklistText}
              onChange={(e) => setChecklistText(e.target.value)}
              placeholder="Написать тест&#10;Проверить сборку&#10;Задеплоить на сервер"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono placeholder:font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Теги (через запятую)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="frontend, bug, auth"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-xs">
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors"
            >
              {loading ? 'Создание...' : 'Добавить карточку'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
