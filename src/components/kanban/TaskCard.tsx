'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  MessageSquare,
  Clock,
  Sparkles,
  Archive,
  User,
  Bot,
  Zap,
  MoreVertical,
  CheckCircle2,
} from 'lucide-react';
import {
  KanbanTaskDetail,
  KANBAN_COLORS,
  KANBAN_PRIORITIES,
  KANBAN_COLUMNS,
  getPriorityConfig,
} from './TaskDetailModal';
import { formatDateTime } from '@/lib/utils';

export default function TaskCard({
  task,
  showProjectChip = false,
  onClick,
  onMoveColumn,
  onArchive,
  onSendToOpenCode,
}: {
  task: KanbanTaskDetail;
  showProjectChip?: boolean;
  onClick: () => void;
  onMoveColumn: (newCol: string) => void;
  onArchive?: () => void;
  onSendToOpenCode?: (task: KanbanTaskDetail) => void;
}) {
  const colorCfg = task.color ? KANBAN_COLORS[task.color] : null;
  const priorityCfg = getPriorityConfig(task.priority);

  // Checklist counts
  const checklists = task.checklists || [];
  let totalItems = 0;
  let completedItems = 0;
  checklists.forEach((cl) => {
    totalItems += cl.items?.length || 0;
    completedItems += cl.items?.filter((i) => i.completed).length || 0;
  });

  const progressPercent =
    task.progressMode === 'manual' && typeof task.progress === 'number'
      ? task.progress
      : totalItems > 0
      ? Math.round((completedItems / totalItems) * 100)
      : typeof task.progress === 'number'
      ? task.progress
      : null;

  const isOverdue = task.dueDate ? task.dueDate < Date.now() : false;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onClick}
      className={`p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 transition-all space-y-2.5 group/card cursor-pointer shadow-md hover:shadow-cyan-500/5 relative overflow-hidden ${
        colorCfg ? `${colorCfg.border} hover:${colorCfg.border}` : ''
      }`}
    >
      {/* Top Color Accent Strip (Trello style) */}
      {colorCfg && (
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${colorCfg.bar}`} />
      )}

      {/* Header chip row: Project Title & Quick Actions */}
      <div className="flex items-center justify-between gap-1 pt-0.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {showProjectChip && task.projectTitle && (
            <span
              onClick={(e) => e.stopPropagation()}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-950 text-cyan-400 border border-slate-800 truncate max-w-[140px]"
            >
              {task.projectTitle}
            </span>
          )}
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border ${priorityCfg.badge}`}
          >
            {priorityCfg.label}
          </span>
          {task.assigneeName?.includes('OpenCode') && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                task.column === 'in_progress'
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
              }`}
              title={`Исполнитель: ${task.assigneeName}`}
            >
              <Zap className="w-2.5 h-2.5 text-cyan-400" />
              <span>{task.column === 'in_progress' ? 'OpenCode в работе' : 'OpenCode'}</span>
            </span>
          )}
        </div>

        {/* Quick action buttons on hover */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0"
        >
          {onSendToOpenCode ? (
            <button
              type="button"
              onClick={() => onSendToOpenCode(task)}
              className="p-1 rounded text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors"
              title="Открыть в OpenCode AI"
            >
              <Zap className="w-3 h-3" />
            </button>
          ) : (
            <Link
              href={`/chat?projectId=${task.projectId}&taskId=${task.id}&taskTitle=${encodeURIComponent(task.title)}`}
              className="p-1 rounded text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors"
              title="Открыть в OpenCode AI"
            >
              <Zap className="w-3 h-3" />
            </Link>
          )}
          {onArchive && (
            <button
              type="button"
              onClick={onArchive}
              className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-colors"
              title="Отправить в архив"
            >
              <Archive className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <h4 className="text-xs font-semibold text-white group-hover/card:text-cyan-300 transition-colors leading-snug">
        {task.title}
      </h4>

      {/* Description Snippet */}
      {task.description && (
        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Progress Bar (if progress > 0) */}
      {progressPercent !== null && progressPercent > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Прогресс</span>
            <span className="text-cyan-400 font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent >= 100 ? 'bg-emerald-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Card Footer: Checklists, Comments, Due Date, Assignee, Quick Move */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-1.5 text-[10px] font-mono text-slate-400 flex-wrap"
      >
        <div className="flex items-center gap-2">
          {/* Checklists Counter */}
          {totalItems > 0 && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                completedItems === totalItems
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                  : 'bg-slate-800 text-slate-300'
              }`}
              title={`Чек-листы: выполнено ${completedItems} из ${totalItems}`}
            >
              <CheckSquare className="w-3 h-3" />
              <span>
                {completedItems}/{totalItems}
              </span>
            </span>
          )}

          {/* Comments Counter */}
          {(task.commentsCount || 0) > 0 && (
            <span
              className="inline-flex items-center gap-1 text-slate-400 hover:text-cyan-300 transition-colors"
              title={`${task.commentsCount} комментариев`}
            >
              <MessageSquare className="w-3 h-3" />
              <span>{task.commentsCount}</span>
            </span>
          )}

          {/* Due date indicator */}
          {task.dueDate && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                isOverdue
                  ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                  : 'text-slate-400'
              }`}
              title={`Срок: ${formatDateTime(task.dueDate)}`}
            >
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
            </span>
          )}

          {/* Assignee indicator */}
          {task.assigneeName && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                task.assigneeName.includes('OpenCode')
                  ? 'bg-cyan-950/70 border border-cyan-500/30 text-cyan-300'
                  : 'bg-slate-800 text-indigo-300'
              }`}
              title={`Исполнитель: ${task.assigneeName}`}
            >
              {task.assigneeName.includes('OpenCode') ? (
                <Bot className="w-3 h-3 text-cyan-400" />
              ) : (
                <User className="w-3 h-3 text-indigo-400" />
              )}
              <span className="truncate max-w-[90px]">{task.assigneeName}</span>
            </span>
          )}
        </div>

        {/* Quick Column Shift Dropdown */}
        <select
          value={task.column}
          onChange={(e) => onMoveColumn(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-300 focus:outline-none cursor-pointer hover:border-cyan-500 transition-colors ml-auto"
        >
          {KANBAN_COLUMNS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label.split(' ')[0]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
