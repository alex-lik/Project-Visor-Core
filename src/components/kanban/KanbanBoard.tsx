'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Kanban,
  Plus,
  Filter,
  Search,
  RefreshCw,
  Archive,
  Layers,
  Sparkles,
  Sliders,
  CheckCircle2,
  ArrowLeftRight,
} from 'lucide-react';
import TaskCard from './TaskCard';
import TaskDetailModal, {
  KanbanTaskDetail,
  KANBAN_COLUMNS,
  KANBAN_PRIORITIES,
} from './TaskDetailModal';
import ArchivedTasksModal from './ArchivedTasksModal';
import CreateTaskModal from '@/components/CreateTaskModal';

interface ProjectOption {
  id: string;
  title: string;
}

export default function KanbanBoard({
  projectId,
  showProjectFilter = true,
  headerSlot,
  bannerSlot,
  className = '',
  onTasksChange,
  onSendToOpenCode,
}: {
  projectId?: string;
  showProjectFilter?: boolean;
  headerSlot?: React.ReactNode;
  bannerSlot?: React.ReactNode;
  className?: string;
  onTasksChange?: () => void;
  onSendToOpenCode?: (task: any) => void;
}) {
  const [tasks, setTasks] = useState<KanbanTaskDetail[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || 'all');
  const [loading, setLoading] = useState(true);

  // Modals
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalDefaultColumn, setCreateModalDefaultColumn] = useState('todo');
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archivedCount, setArchivedCount] = useState<number>(0);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Drag and drop state
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Sync prop changes
  useEffect(() => {
    if (projectId) {
      setSelectedProjectId(projectId);
    }
  }, [projectId]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (selectedProjectId && selectedProjectId !== 'all') {
        q.set('projectId', selectedProjectId);
      }
      const [taskRes, projRes, archRes] = await Promise.all([
        fetch(`/api/kanban/tasks?${q.toString()}`),
        fetch('/api/projects'),
        fetch(`/api/kanban/tasks?archived=only${selectedProjectId && selectedProjectId !== 'all' ? `&projectId=${selectedProjectId}` : ''}`),
      ]);

      if (taskRes.ok) {
        const taskData = await taskRes.json();
        setTasks(taskData.tasks || []);
      }
      if (projRes.ok) {
        const projData = await projRes.json();
        setProjects(projData.projects || []);
      }
      if (archRes.ok) {
        const archData = await archRes.json();
        setArchivedCount(archData.total || (archData.tasks || []).length || 0);
      }
    } catch (err) {
      console.error('Failed to load kanban tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [selectedProjectId]);

  const handleMoveTask = async (taskId: string, newColumn: string) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, column: newColumn } : t))
    );
    try {
      await fetch(`/api/kanban/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column: newColumn }),
      });
      fetchTasks();
      onTasksChange?.();
    } catch (err) {
      console.error('Failed to move task:', err);
      fetchTasks();
    }
  };

  const handleQuickArchive = async (taskId: string) => {
    try {
      await fetch(`/api/kanban/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: 1 }),
      });
      fetchTasks();
      onTasksChange?.();
    } catch (err) {
      console.error('Failed to archive task:', err);
    }
  };

  // Drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (dragOverColumn === colId) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      handleMoveTask(taskId, colId);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (priorityFilter !== 'all') {
        const tNorm = t.priority === 'critical' ? 'urgent' : (t.priority || 'medium');
        const fNorm = priorityFilter === 'critical' ? 'urgent' : priorityFilter;
        if (tNorm !== fNorm) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchProj = t.projectTitle?.toLowerCase().includes(q);
        const matchAssignee = t.assigneeName?.toLowerCase().includes(q);
        const matchTags = (t.tags || []).some((tg) => tg.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchProj && !matchAssignee && !matchTags) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, priorityFilter, searchQuery]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Filter and Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
          {/* Project selector dropdown (if in global mode) */}
          {showProjectFilter && !projectId && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 max-w-[200px] truncate"
            >
              <option value="all">Все проекты ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}

          {/* Search box */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по задачам..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">Все приоритеты</option>
            {KANBAN_PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchTasks}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 transition-colors"
            title="Обновить доску"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {headerSlot}

          {/* Trello Sync entry: селективная синхронизация досок/списков */}
          <Link
            href="/settings/integrations"
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Настроить синхронизацию с Trello: выбор досок и списков"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
            <span>Trello Sync</span>
          </Link>

          {/* Archive Button */}
          <button
            type="button"
            onClick={() => setIsArchiveModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Открыть архив задач"
          >
            <Archive className="w-3.5 h-3.5 text-amber-400" />
            <span>Архив</span>
            {archivedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono">
                {archivedCount}
              </span>
            )}
          </button>

          {/* Add Task Button */}
          <button
            type="button"
            onClick={() => {
              setCreateModalDefaultColumn('todo');
              setIsCreateModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить задачу</span>
          </button>
        </div>
      </div>

      {bannerSlot}

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto min-w-[1000px] pb-6">
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.column === col.id);
          const isOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`p-3.5 rounded-2xl bg-[#0f172a] border transition-all flex flex-col min-h-[500px] ${
                isOver
                  ? 'border-cyan-400 ring-2 ring-cyan-500/30 bg-cyan-950/20'
                  : 'border-slate-800'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800/80">
                <span className="text-xs font-bold font-mono uppercase text-slate-300 tracking-wide flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.border.replace('border-', 'bg-')}`} />
                  {col.label}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-semibold">
                  {colTasks.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-3 flex-1">
                {loading ? (
                  <div className="space-y-2.5 animate-pulse">
                    <div className="h-24 bg-slate-900/60 rounded-xl border border-slate-800/40 p-3 space-y-2" />
                    <div className="h-20 bg-slate-900/40 rounded-xl border border-slate-800/30 p-3 space-y-2" />
                  </div>
                ) : colTasks.length === 0 ? (
                  <div
                    className={`h-36 flex flex-col items-center justify-center border border-dashed rounded-xl text-xs font-mono transition-colors ${
                      isOver
                        ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                        : 'border-slate-800/60 text-slate-600'
                    }`}
                  >
                    <span>{isOver ? 'Перетащите сюда' : 'Колонка пуста'}</span>
                  </div>
                ) : (
                  colTasks.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      showProjectChip={selectedProjectId === 'all' || !projectId}
                      onClick={() => setActiveTaskId(t.id)}
                      onMoveColumn={(newCol) => handleMoveTask(t.id, newCol)}
                      onArchive={() => handleQuickArchive(t.id)}
                      onSendToOpenCode={onSendToOpenCode}
                    />
                  ))
                )}
              </div>

              {/* Quick Add Button at bottom of column */}
              <button
                type="button"
                onClick={() => {
                  setCreateModalDefaultColumn(col.id);
                  setIsCreateModalOpen(true);
                }}
                className="mt-3 py-2 px-3 rounded-xl border border-dashed border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/60 text-slate-400 hover:text-cyan-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить карточку</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Task Detail Modal (Trello style) */}
      <TaskDetailModal
        taskId={activeTaskId}
        isOpen={Boolean(activeTaskId)}
        onClose={() => setActiveTaskId(null)}
        onTaskUpdated={() => {
          fetchTasks();
          onTasksChange?.();
        }}
        onTaskDeleted={() => {
          fetchTasks();
          onTasksChange?.();
        }}
        onSendToOpenCode={onSendToOpenCode}
      />

      {/* Archived Tasks Modal */}
      <ArchivedTasksModal
        isOpen={isArchiveModalOpen}
        projectId={selectedProjectId !== 'all' ? selectedProjectId : undefined}
        onClose={() => setIsArchiveModalOpen(false)}
        onTaskRestored={() => {
          fetchTasks();
          onTasksChange?.();
        }}
        onTaskDeleted={() => {
          fetchTasks();
          onTasksChange?.();
        }}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        defaultProjectId={
          selectedProjectId && selectedProjectId !== 'all'
            ? selectedProjectId
            : projectId || undefined
        }
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => {
          fetchTasks();
          onTasksChange?.();
        }}
      />
    </div>
  );
}
