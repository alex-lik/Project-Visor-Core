'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  User,
  Bot,
  Send,
  Calendar,
  Archive,
  RotateCcw,
  Check,
  AlertTriangle,
  Tag,
  Sliders,
  MessageSquare,
  Layers,
  ArrowRight,
  ExternalLink,
  Zap,
  ListTodo,
  Palette,
  CheckCircle2,
} from 'lucide-react';
import { KanbanChecklist, KanbanChecklistItem } from '@/db/schema';
import { formatDateTime } from '@/lib/utils';
import { nanoid } from 'nanoid';

export interface KanbanTaskDetail {
  id: string;
  projectId: string;
  projectTitle?: string;
  projectSlug?: string;
  title: string;
  description?: string | null;
  column: string;
  priority: string;
  position: number;
  tags?: string[];
  dueDate?: number | null;
  isArchived?: number;
  color?: string | null;
  checklists?: KanbanChecklist[];
  progress?: number | null;
  progressMode?: string;
  assigneeName?: string | null;
  createdAt: number;
  updatedAt: number;
  commentsCount?: number;
  comments?: Array<{
    id: string;
    taskId: string;
    authorType: 'user' | 'agent' | 'system' | string;
    authorName: string;
    content: string;
    createdAt: number;
    updatedAt?: number | null;
  }>;
}

export const KANBAN_COLORS: Record<string, { label: string; bg: string; border: string; bar: string; badge: string }> = {
  emerald: {
    label: 'Изумрудный',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  sky: {
    label: 'Небесный',
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/30',
    bar: 'bg-sky-500',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  },
  indigo: {
    label: 'Индиго',
    bg: 'bg-indigo-500/15',
    border: 'border-indigo-500/30',
    bar: 'bg-indigo-500',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
  purple: {
    label: 'Фиолетовый',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/30',
    bar: 'bg-purple-500',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
  amber: {
    label: 'Янтарный',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    bar: 'bg-amber-500',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  orange: {
    label: 'Оранжевый',
    bg: 'bg-orange-500/15',
    border: 'border-orange-500/30',
    bar: 'bg-orange-500',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  },
  rose: {
    label: 'Красный / Рубиновый',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/30',
    bar: 'bg-rose-500',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
};

export const KANBAN_COLUMNS = [
  { id: 'backlog', label: 'Бэклог', border: 'border-slate-800', headerBg: 'bg-slate-900/60' },
  { id: 'todo', label: 'To Do (К выполнению)', border: 'border-amber-500/40', headerBg: 'bg-amber-950/20' },
  { id: 'in_progress', label: 'В работе (In Progress)', border: 'border-cyan-500/40', headerBg: 'bg-cyan-950/20' },
  { id: 'review', label: 'Ревью / Тест', border: 'border-indigo-500/40', headerBg: 'bg-indigo-950/20' },
  { id: 'done', label: 'Выполнено (Done)', border: 'border-emerald-500/40', headerBg: 'bg-emerald-950/20' },
];

export const KANBAN_PRIORITIES = [
  { id: 'low', label: 'Низкий', badge: 'bg-slate-800 text-slate-300 border-slate-700' },
  { id: 'medium', label: 'Средний', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  { id: 'high', label: 'Высокий', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { id: 'urgent', label: 'Срочно 🔥', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
];

export function getPriorityConfig(priority?: string) {
  const norm = (priority || 'medium').toLowerCase();
  if (norm === 'urgent' || norm === 'critical') {
    return KANBAN_PRIORITIES[3]; // urgent / Срочно 🔥
  }
  if (norm === 'high') {
    return KANBAN_PRIORITIES[2]; // high / Высокий
  }
  if (norm === 'low') {
    return KANBAN_PRIORITIES[0]; // low / Низкий
  }
  return KANBAN_PRIORITIES[1]; // medium / Средний
}

export default function TaskDetailModal({
  taskId,
  isOpen,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
  onSendToOpenCode,
}: {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
  onTaskDeleted: () => void;
  onSendToOpenCode?: (task: KanbanTaskDetail) => void;
}) {
  const [task, setTask] = useState<KanbanTaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState('');

  // Checklists state
  const [checklists, setChecklists] = useState<KanbanChecklist[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [isAddingChecklist, setIsAddingChecklist] = useState(false);
  const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});

  // Progress state
  const [progressMode, setProgressMode] = useState<'auto' | 'manual'>('auto');
  const [manualProgress, setManualProgress] = useState<number>(0);

  // Comments state
  const [comments, setComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [commentAuthorType, setCommentAuthorType] = useState<'user' | 'agent'>('user');
  const [commentAuthorName, setCommentAuthorName] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // New tag input
  const [tagInput, setTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  const fetchTaskDetails = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/kanban/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        const t = data.task as KanbanTaskDetail;
        setTask(t);
        setTitleInput(t.title);
        setDescInput(t.description || '');
        setChecklists(t.checklists || []);
        setProgressMode((t.progressMode as any) || 'auto');
        setManualProgress(t.progress ?? 0);
        setComments(t.comments || []);
      }
    } catch (err) {
      console.error('Failed to fetch task details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      fetchTaskDetails();
    } else {
      setTask(null);
      setIsEditingTitle(false);
      setIsEditingDesc(false);
      setIsAddingChecklist(false);
      setCommentInput('');
    }
  }, [isOpen, taskId]);

  if (!isOpen || !taskId) return null;

  // Save task patch
  const saveTaskPatch = async (patch: Partial<KanbanTaskDetail>) => {
    if (!taskId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/kanban/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setTask((prev) => (prev ? { ...prev, ...patch } : prev));
        onTaskUpdated();
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    } finally {
      setSaving(false);
    }
  };

  // Title save
  const handleSaveTitle = () => {
    const trimmed = titleInput.trim();
    if (trimmed && trimmed !== task?.title) {
      saveTaskPatch({ title: trimmed });
    }
    setIsEditingTitle(false);
  };

  // Description save
  const handleSaveDescription = () => {
    if (descInput !== task?.description) {
      saveTaskPatch({ description: descInput });
    }
    setIsEditingDesc(false);
  };

  // Checklist handlers
  const handleAddChecklist = () => {
    const title = newChecklistTitle.trim() || 'Чек-лист';
    const newCl: KanbanChecklist = {
      id: `cl_${nanoid(8)}`,
      title,
      items: [],
    };
    const updated = [...checklists, newCl];
    setChecklists(updated);
    setNewChecklistTitle('');
    setIsAddingChecklist(false);
    saveTaskPatch({ checklists: updated });
  };

  const handleDeleteChecklist = (clId: string) => {
    const updated = checklists.filter((cl) => cl.id !== clId);
    setChecklists(updated);
    saveTaskPatch({ checklists: updated });
  };

  const handleAddItemToChecklist = (clId: string) => {
    const text = (newItemTexts[clId] || '').trim();
    if (!text) return;
    const newItem: KanbanChecklistItem = {
      id: `cli_${nanoid(8)}`,
      text,
      completed: false,
    };
    const updated = checklists.map((cl) => {
      if (cl.id === clId) {
        return { ...cl, items: [...cl.items, newItem] };
      }
      return cl;
    });
    setChecklists(updated);
    setNewItemTexts((prev) => ({ ...prev, [clId]: '' }));
    saveTaskPatch({ checklists: updated });
  };

  const handleToggleChecklistItem = (clId: string, itemId: string) => {
    const updated = checklists.map((cl) => {
      if (cl.id === clId) {
        return {
          ...cl,
          items: cl.items.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
          ),
        };
      }
      return cl;
    });
    setChecklists(updated);
    saveTaskPatch({ checklists: updated });
  };

  const handleDeleteChecklistItem = (clId: string, itemId: string) => {
    const updated = checklists.map((cl) => {
      if (cl.id === clId) {
        return {
          ...cl,
          items: cl.items.filter((item) => item.id !== itemId),
        };
      }
      return cl;
    });
    setChecklists(updated);
    saveTaskPatch({ checklists: updated });
  };

  // Overall checklist calculations
  let totalItemsCount = 0;
  let completedItemsCount = 0;
  checklists.forEach((cl) => {
    totalItemsCount += cl.items.length;
    completedItemsCount += cl.items.filter((i) => i.completed).length;
  });

  const computedAutoProgress =
    totalItemsCount > 0 ? Math.round((completedItemsCount / totalItemsCount) * 100) : 0;
  const displayProgress = progressMode === 'manual' ? manualProgress : computedAutoProgress;

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = commentInput.trim();
    if (!clean || !taskId || submittingComment) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/kanban/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: clean,
          authorType: commentAuthorType,
          authorName: commentAuthorName.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.comment) {
          setComments((prev) => [...prev, data.comment]);
        }
        setCommentInput('');
        onTaskUpdated();
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Удалить этот комментарий?')) return;
    try {
      const res = await fetch(`/api/kanban/tasks/${taskId}/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        onTaskUpdated();
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // Archive / Restore
  const handleToggleArchive = async () => {
    const nextArchived = task?.isArchived === 1 ? 0 : 1;
    await saveTaskPatch({ isArchived: nextArchived });
    onClose();
  };

  // Delete Task permanently
  const handleDeleteTask = async () => {
    if (!confirm('Вы уверены, что хотите навсегда удалить эту задачу и все её комментарии?')) return;
    try {
      const res = await fetch(`/api/kanban/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        onTaskDeleted();
        onClose();
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  // Add tag
  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    const currentTags = task?.tags || [];
    if (!currentTags.includes(trimmed)) {
      const updated = [...currentTags, trimmed];
      saveTaskPatch({ tags: updated });
    }
    setTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = task?.tags || [];
    const updated = currentTags.filter((t) => t !== tagToRemove);
    saveTaskPatch({ tags: updated });
  };

  const currentColorConfig = task?.color ? KANBAN_COLORS[task.color] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Top Accent Color Bar / Cover (Trello style) */}
        {currentColorConfig ? (
          <div className={`h-4 w-full ${currentColorConfig.bar} shadow-sm shrink-0`} />
        ) : (
          <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 to-indigo-500 shrink-0" />
        )}

        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-slate-900/60 flex items-start justify-between gap-4 shrink-0">
          <div className="flex-1 min-w-0">
            {/* Project Chip and Column Breadcrumbs */}
            <div className="flex items-center gap-2 flex-wrap text-xs mb-2">
              {task?.projectTitle && (
                <Link
                  href={`/projects/${task.projectId}`}
                  className="px-2.5 py-0.5 rounded-md font-mono font-medium bg-slate-950 text-cyan-400 border border-slate-800 hover:border-cyan-500/50 flex items-center gap-1 transition-colors"
                >
                  <Layers className="w-3 h-3 text-cyan-400" />
                  <span>{task.projectTitle}</span>
                </Link>
              )}
              <span className="text-slate-600">/</span>
              <span className="text-slate-400 font-mono">
                в колонке <span className="text-white font-semibold underline">{KANBAN_COLUMNS.find((c) => c.id === task?.column)?.label || task?.column}</span>
              </span>
              {task?.isArchived === 1 && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                  <Archive className="w-3 h-3" /> В архиве
                </span>
              )}
            </div>

            {/* Editable Title */}
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  autoFocus
                  className="w-full text-lg sm:text-xl font-bold text-white bg-slate-950 border border-cyan-500 rounded-lg px-3 py-1.5 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  className="px-3 py-1.5 bg-cyan-500 text-slate-950 rounded-lg font-bold text-xs"
                >
                  OK
                </button>
              </div>
            ) : (
              <h2
                onClick={() => setIsEditingTitle(true)}
                className="text-lg sm:text-xl font-bold text-white hover:text-cyan-300 cursor-pointer transition-colors leading-snug flex items-center gap-2 group"
                title="Кликните для редактирования заголовка"
              >
                <span>{task?.title || 'Загрузка...'}</span>
                <span className="text-[11px] opacity-0 group-hover:opacity-100 text-slate-500 font-normal">
                  (редактировать)
                </span>
              </h2>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: Main Task Details, Checklists, Comments */}
          <div className="lg:col-span-2 space-y-6">
            {/* OpenCode Live Agent Banner */}
            {task?.assigneeName?.includes('OpenCode') && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/50 via-slate-900 to-indigo-950/50 border border-cyan-500/40 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-cyan-400 animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">OpenCode AI Агент на задаче</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        task.column === 'in_progress'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse'
                          : task.column === 'done'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {task.column === 'in_progress' ? 'В процессе выполнения' : task.column === 'done' ? 'Выполнена' : task.column}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      Исполнитель: {task.assigneeName}. Все отчеты и Git diff сохраняются в истории задачи.
                    </p>
                  </div>
                </div>
                {onSendToOpenCode ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSendToOpenCode(task);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shrink-0 transition-colors shadow-sm"
                  >
                    Перейти в диалог
                  </button>
                ) : (
                  <Link
                    href={`/chat?projectId=${task.projectId}&taskId=${task.id}&taskTitle=${encodeURIComponent(task.title)}`}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shrink-0 transition-colors shadow-sm"
                  >
                    Перейти в диалог
                  </Link>
                )}
              </div>
            )}

            {/* Quick Badges: Priority, Due Date, Assignee, Progress */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Priority Chip */}
              {(() => {
                const pConfig = getPriorityConfig(task?.priority);
                return (
                  <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ${pConfig.badge}`}>
                    <span>Приоритет: {pConfig.label}</span>
                  </div>
                );
              })()}

              {/* Due Date Chip */}
              {task?.dueDate && (
                <div
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border flex items-center gap-1.5 ${
                    task.dueDate < Date.now()
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Срок: {formatDateTime(task.dueDate)}</span>
                  {task.dueDate < Date.now() && <span className="font-bold text-rose-400">Просрочено</span>}
                </div>
              )}

              {/* Assignee Chip */}
              {task?.assigneeName && (
                <div className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-200 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Исполнитель: {task.assigneeName}</span>
                </div>
              )}

              {/* Tags */}
              {(task?.tags || []).map((tg) => (
                <span
                  key={tg}
                  className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-cyan-400 font-mono flex items-center gap-1 group/tag"
                >
                  #{tg}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tg)}
                    className="opacity-0 group-hover/tag:opacity-100 hover:text-rose-400 transition-opacity ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}

              {isAddingTag ? (
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                      if (e.key === 'Escape') setIsAddingTag(false);
                    }}
                    placeholder="тег..."
                    autoFocus
                    className="px-2 py-0.5 rounded bg-slate-950 border border-cyan-500 text-xs text-white w-20 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-1.5 py-0.5 bg-cyan-500 text-slate-950 rounded text-xs font-bold"
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingTag(true)}
                  className="px-2 py-0.5 rounded border border-dashed border-slate-700 hover:border-slate-500 text-[11px] text-slate-400 hover:text-white transition-colors"
                >
                  + тег
                </button>
              )}
            </div>

            {/* Overall Progress Bar (Trello style) */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Прогресс выполнения:</span>
                  <span className="font-mono text-cyan-400 font-bold">{displayProgress}%</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({progressMode === 'auto' ? 'Авторасчёт по чек-листам' : 'Ручной ввод'})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = progressMode === 'auto' ? 'manual' : 'auto';
                    setProgressMode(nextMode);
                    saveTaskPatch({ progressMode: nextMode });
                  }}
                  className="text-[11px] text-cyan-400 hover:underline"
                >
                  {progressMode === 'auto' ? 'Переключить на ручной ввод' : 'Переключить на авторасчёт'}
                </button>
              </div>

              {/* Visual Progress Bar */}
              <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    displayProgress >= 100
                      ? 'bg-emerald-500'
                      : displayProgress >= 50
                      ? 'bg-cyan-500'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${displayProgress}%` }}
                />
              </div>

              {progressMode === 'manual' && (
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={manualProgress}
                    onChange={(e) => setManualProgress(Number(e.target.value))}
                    onMouseUp={() => saveTaskPatch({ progress: manualProgress, progressMode: 'manual' })}
                    onTouchEnd={() => saveTaskPatch({ progress: manualProgress, progressMode: 'manual' })}
                    className="flex-1 accent-cyan-500 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-300 w-10 text-right">{manualProgress}%</span>
                </div>
              )}
            </div>

            {/* Description Block */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Описание задачи
                </h3>
                {!isEditingDesc && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDesc(true)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                  >
                    {task?.description ? 'Редактировать' : '+ Добавить описание'}
                  </button>
                )}
              </div>

              {isEditingDesc ? (
                <div className="space-y-2">
                  <textarea
                    rows={5}
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    placeholder="Подробное описание задачи, контекст, ссылки на файлы или документацию..."
                    className="w-full p-3 bg-slate-950 border border-cyan-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none resize-y leading-relaxed font-sans"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveDescription}
                      className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDescInput(task?.description || '');
                        setIsEditingDesc(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsEditingDesc(true)}
                  className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed cursor-pointer hover:border-slate-700 transition-colors min-h-[60px]"
                >
                  {task?.description ? task.description : <span className="text-slate-500 italic">Описание не указано. Нажмите, чтобы добавить.</span>}
                </div>
              )}
            </div>

            {/* Checklists (Списки внутри задачи - Trello style) */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                    Чек-листы & Подзадачи ({checklists.length})
                  </h3>
                </div>
                {!isAddingChecklist && (
                  <button
                    type="button"
                    onClick={() => setIsAddingChecklist(true)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Добавить список
                  </button>
                )}
              </div>

              {/* Form to create a new checklist */}
              {isAddingChecklist && (
                <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2">
                  <input
                    type="text"
                    value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddChecklist();
                      if (e.key === 'Escape') setIsAddingChecklist(false);
                    }}
                    placeholder="Название чек-листа (например: Критерии готовности, Тестирование)..."
                    autoFocus
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddChecklist}
                      className="px-3 py-1 bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg"
                    >
                      Создать чек-лист
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingChecklist(false)}
                      className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded-lg hover:bg-slate-700"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}

              {/* List of checklists */}
              {checklists.map((cl) => {
                const total = cl.items.length;
                const completed = cl.items.filter((i) => i.completed).length;
                const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <div
                    key={cl.id}
                    className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-xs font-bold text-white">{cl.title}</h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                          {completed}/{total} ({percent}%)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteChecklist(cl.id)}
                        className="text-slate-500 hover:text-rose-400 text-xs transition-colors p-1"
                        title="Удалить весь чек-лист"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Checklist progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800/80">
                      <div
                        className={`h-full transition-all duration-300 ${
                          percent >= 100 ? 'bg-emerald-400' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    {/* Items */}
                    <div className="space-y-1.5">
                      {cl.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-800/50 group"
                        >
                          <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={() => handleToggleChecklistItem(cl.id, item.id)}
                              className="accent-cyan-500 w-3.5 h-3.5 rounded cursor-pointer"
                            />
                            <span
                              className={`truncate leading-relaxed ${
                                item.completed ? 'line-through text-slate-500' : 'text-slate-200'
                              }`}
                            >
                              {item.text}
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDeleteChecklistItem(cl.id, item.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition-opacity p-0.5"
                            title="Удалить пункт"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Item to Checklist input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newItemTexts[cl.id] || ''}
                        onChange={(e) =>
                          setNewItemTexts((prev) => ({ ...prev, [cl.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddItemToChecklist(cl.id);
                          }
                        }}
                        placeholder="Добавить пункт (Enter)..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddItemToChecklist(cl.id)}
                        disabled={!(newItemTexts[cl.id] || '').trim()}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 font-semibold text-xs rounded-lg transition-colors disabled:opacity-40"
                      >
                        Добавить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comments & Activity Stream (Пользователи & AI Агенты) */}
            <div className="space-y-4 pt-4 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Комментарии и обсуждение ({comments.length})
                </h3>
              </div>

              {/* New Comment Form */}
              <form
                onSubmit={handleAddComment}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">Автор:</span>
                    <button
                      type="button"
                      onClick={() => setCommentAuthorType(commentAuthorType === 'user' ? 'agent' : 'user')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 transition-colors ${
                        commentAuthorType === 'agent'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                      }`}
                    >
                      {commentAuthorType === 'agent' ? (
                        <>
                          <Bot className="w-3 h-3 text-purple-400" />
                          <span>AI Агент</span>
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3 text-indigo-400" />
                          <span>Пользователь</span>
                        </>
                      )}
                    </button>
                  </div>

                  {commentAuthorType === 'agent' && (
                    <input
                      type="text"
                      value={commentAuthorName}
                      onChange={(e) => setCommentAuthorName(e.target.value)}
                      placeholder="Имя агента (e.g. OpenCode Agent)"
                      className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-purple-300 focus:outline-none focus:border-purple-500 w-44"
                    />
                  )}
                </div>

                <textarea
                  rows={2}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Оставьте комментарий, заметку о прогрессе или отчет агента..."
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none font-sans"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!commentInput.trim() || submittingComment}
                    className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Send className="w-3 h-3" />
                    <span>Отправить</span>
                  </button>
                </div>
              </form>

              {/* Comments Timeline */}
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    Комментариев пока нет. Вы можете оставить первый комментарий выше.
                  </p>
                ) : (
                  comments.map((comm) => {
                    const isAgent = comm.authorType === 'agent';
                    return (
                      <div
                        key={comm.id}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                          isAgent
                            ? 'bg-purple-950/20 border-purple-500/30 shadow-sm'
                            : 'bg-slate-900/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            {isAgent ? (
                              <div className="w-5 h-5 rounded-md bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                                <Bot className="w-3 h-3" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-md bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                                <User className="w-3 h-3" />
                              </div>
                            )}
                            <span className={`font-semibold ${isAgent ? 'text-purple-300' : 'text-slate-200'}`}>
                              {comm.authorName}
                            </span>
                            {isAgent && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900/40 text-purple-300 border border-purple-500/30 uppercase font-mono">
                                Agent
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-mono text-[10px]">
                              {formatDateTime(comm.createdAt)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(comm.id)}
                              className="text-slate-600 hover:text-rose-400 p-0.5"
                              title="Удалить комментарий"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="text-slate-200 whitespace-pre-wrap leading-relaxed pl-7 font-sans text-xs">
                          {comm.content}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT 1 COLUMN: Action Sidebar (Trello style) */}
          <div className="space-y-5">
            {/* Status / Column Mover */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Колонка / Этап
              </label>
              <select
                value={task?.column || 'todo'}
                onChange={(e) => saveTaskPatch({ column: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
              >
                {KANBAN_COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Selector */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Приоритет
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {KANBAN_PRIORITIES.map((pr) => {
                  const currentPriorityNorm = (task?.priority === 'critical' ? 'urgent' : task?.priority) || 'medium';
                  const isSelected = currentPriorityNorm === pr.id;
                  return (
                    <button
                      key={pr.id}
                      type="button"
                      onClick={() => saveTaskPatch({ priority: pr.id })}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                        isSelected
                          ? `${pr.badge} ring-1 ring-cyan-500`
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      {pr.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card Cover Color Palette (Trello style) */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-cyan-400" />
                <span>Цвет карточки (Обложка)</span>
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => saveTaskPatch({ color: null })}
                  className={`w-6 h-6 rounded-md border text-[10px] flex items-center justify-center font-bold transition-all ${
                    !task?.color ? 'border-cyan-400 text-cyan-400 bg-cyan-950' : 'border-slate-700 text-slate-500 hover:border-slate-500'
                  }`}
                  title="Без цвета"
                >
                  ✕
                </button>
                {Object.entries(KANBAN_COLORS).map(([cKey, cCfg]) => {
                  const isSelected = task?.color === cKey;
                  return (
                    <button
                      key={cKey}
                      type="button"
                      onClick={() => saveTaskPatch({ color: cKey })}
                      className={`w-6 h-6 rounded-md ${cCfg.bar} transition-all shadow-sm flex items-center justify-center ${
                        isSelected ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105'
                      }`}
                      title={cCfg.label}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-slate-950 font-bold" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Due Date Input */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Срок сдачи (Дедлайн)</span>
              </label>
              <input
                type="datetime-local"
                value={
                  task?.dueDate
                    ? new Date(task.dueDate - new Date().getTimezoneOffset() * 60000)
                        .toISOString()
                        .slice(0, 16)
                    : ''
                }
                onChange={(e) => {
                  const val = e.target.value;
                  const ts = val ? new Date(val).getTime() : null;
                  saveTaskPatch({ dueDate: ts });
                }}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
              {task?.dueDate && (
                <button
                  type="button"
                  onClick={() => saveTaskPatch({ dueDate: null })}
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  Очистить срок
                </button>
              )}
            </div>

            {/* Assignee Input */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>Исполнитель</span>
              </label>
              <input
                type="text"
                defaultValue={task?.assigneeName || ''}
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== task?.assigneeName) {
                    saveTaskPatch({ assigneeName: v });
                  }
                }}
                placeholder="Имя разработчика или агента..."
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* OpenCode AI Action Card */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-950/40 to-cyan-950/40 border border-cyan-500/30 space-y-2.5">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>OpenCode AI Решатель</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Передать задачу напрямую ассистенту OpenCode для автоматического анализа файлов и выполнения.
              </p>
              {onSendToOpenCode && task ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSendToOpenCode(task);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-500/20"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Открыть в OpenCode</span>
                </button>
              ) : (
                <Link
                  href={`/chat?projectId=${task?.projectId}&taskId=${task?.id}&taskTitle=${encodeURIComponent(task?.title || '')}`}
                  className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-500/20"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Открыть в OpenCode</span>
                </Link>
              )}
            </div>

            {/* Archive / Delete Actions */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                type="button"
                onClick={handleToggleArchive}
                className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                {task?.isArchived === 1 ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Восстановить из архива</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-3.5 h-3.5 text-amber-400" />
                    <span>Отправить в архив</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDeleteTask}
                className="w-full py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Удалить задачу навсегда</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
