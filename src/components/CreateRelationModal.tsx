'use client';

import React, { useState, useEffect } from 'react';
import { X, Network, Link as LinkIcon, Plus, Trash2, Tags } from 'lucide-react';
import { fetchCustomRelationTypes, type CustomRelationTypeOption } from '@/lib/utils';

interface ProjectOption {
  id: string;
  title: string;
}

export interface EditingRelation {
  id: string;
  sourceProjectId: string;
  targetProjectId: string;
  relationType: string;
  description?: string | null;
}

export default function CreateRelationModal({
  isOpen,
  defaultSourceId,
  editingRelation,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  defaultSourceId?: string;
  editingRelation?: EditingRelation | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const isEditMode = Boolean(editingRelation);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [sourceId, setSourceId] = useState(defaultSourceId || '');
  const [targetId, setTargetId] = useState('');
  const [relationType, setRelationType] = useState('depends_on');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Пользовательские типы связей
  const [customTypes, setCustomTypes] = useState<CustomRelationTypeOption[]>([]);
  const [manageTypesOpen, setManageTypesOpen] = useState(false);
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('#94a3b8');
  const [typeBusy, setTypeBusy] = useState(false);
  const [typeMsg, setTypeMsg] = useState('');

  const loadCustomTypes = async () => {
    const list = await fetchCustomRelationTypes();
    setCustomTypes(list);
  };

  useEffect(() => {
    if (defaultSourceId && !editingRelation) setSourceId(defaultSourceId);
  }, [defaultSourceId, editingRelation]);

  useEffect(() => {
    if (editingRelation) {
      setSourceId(editingRelation.sourceProjectId);
      setTargetId(editingRelation.targetProjectId);
      setRelationType(editingRelation.relationType || 'depends_on');
      setDescription(editingRelation.description || '');
      setError('');
    } else if (isOpen) {
      setError('');
    }
  }, [editingRelation, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadCustomTypes();
      fetch('/api/projects')
        .then((r) => r.json())
        .then((d) => {
          if (d.projects) {
            setProjects(d.projects);
            if (editingRelation) return;
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
      const isEdit = Boolean(editingRelation);
      const res = await fetch('/api/relations', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? {
                id: editingRelation!.id,
                sourceProjectId: sourceId,
                targetProjectId: targetId,
                relationType,
                description,
              }
            : {
                sourceProjectId: sourceId,
                targetProjectId: targetId,
                relationType,
                description,
              }
        ),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (isEdit ? 'Ошибка обновления связи' : 'Ошибка создания связи'));

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddType = async () => {
    const label = newTypeLabel.trim();
    if (!label) {
      setTypeMsg('Введите название типа');
      return;
    }
    setTypeBusy(true);
    setTypeMsg('');
    try {
      const res = await fetch('/api/relations/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, color: newTypeColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания типа');
      setNewTypeLabel('');
      await loadCustomTypes();
      if (data.type?.key) setRelationType(data.type.key);
      setTypeMsg('✓ Тип добавлен и выбран');
    } catch (err: any) {
      setTypeMsg(err.message);
    } finally {
      setTypeBusy(false);
    }
  };

  const handleDeleteType = async (id: string) => {
    if (!confirm('Удалить этот тип связи?')) return;
    setTypeBusy(true);
    setTypeMsg('');
    try {
      const res = await fetch(`/api/relations/types?id=${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Ошибка удаления типа');
      await loadCustomTypes();
    } catch (err: any) {
      setTypeMsg(err.message);
    } finally {
      setTypeBusy(false);
    }
  };

  const knownTypeKeys = new Set([
    'depends_on',
    'api_calls',
    'database_shared',
    'webhook_events',
    'auth_provider',
    'submodule',
    'promotes_to_staging',
    'promotes_to_production',
    'env_pair',
    ...customTypes.map((t) => t.key),
  ]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Network className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">{isEditMode ? 'Редактировать связь' : 'Добавить связь между проектами'}</h2>
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">Тип связи</label>
              <button
                type="button"
                onClick={() => setManageTypesOpen((v) => !v)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <Tags className="w-3 h-3" /> Мои типы
              </button>
            </div>
            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm"
            >
              <optgroup label="Встроенные">
                <option value="depends_on">⚡ Зависит от сервиса</option>
                <option value="api_calls">🔌 Вызывает REST/gRPC API</option>
                <option value="database_shared">🗄️ Использует общую базу данных</option>
                <option value="webhook_events">📨 Отправляет вебхуки / события</option>
                <option value="auth_provider">🔐 Провайдер авторизации (OAuth/JWT)</option>
                <option value="submodule">📦 Подмодуль / библиотека</option>
                <option value="promotes_to_staging">🧪 Промотируется в Staging (Dev → Test)</option>
                <option value="promotes_to_production">🚀 Промотируется в Production (Staging → Prod)</option>
                <option value="env_pair">🔄 Окружения одного сервиса (dev-* ↔ prod-*)</option>
              </optgroup>
              {customTypes.length > 0 && (
                <optgroup label="Мои типы">
                  {customTypes.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {!knownTypeKeys.has(relationType) && (
                <option value={relationType}>Неизвестный тип: {relationType}</option>
              )}
            </select>

            {manageTypesOpen && (
              <div className="mt-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                {customTypes.length === 0 ? (
                  <div className="text-[11px] text-slate-500">
                    Своих типов пока нет — создайте первый ниже.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {customTypes.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: t.color }}
                          />
                          <span className="text-xs text-slate-200 truncate">{t.label}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteType(t.id)}
                          disabled={typeBusy}
                          className="text-slate-500 hover:text-rose-400 p-1 shrink-0"
                          title="Удалить тип"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="color"
                    value={newTypeColor}
                    onChange={(e) => setNewTypeColor(e.target.value)}
                    className="w-8 h-8 rounded bg-transparent cursor-pointer shrink-0"
                    title="Цвет типа"
                  />
                  <input
                    type="text"
                    value={newTypeLabel}
                    onChange={(e) => setNewTypeLabel(e.target.value)}
                    placeholder="Название нового типа…"
                    maxLength={60}
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddType}
                    disabled={typeBusy}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1 shrink-0 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Добавить
                  </button>
                </div>
                {typeMsg && <div className="text-[11px] text-slate-400">{typeMsg}</div>}
              </div>
            )}
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
              {loading ? (isEditMode ? 'Сохранение...' : 'Создание...') : isEditMode ? 'Сохранить изменения' : 'Сохранить связь'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
