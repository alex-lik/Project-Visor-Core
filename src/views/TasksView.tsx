'use client';

import React from 'react';
import { Kanban } from 'lucide-react';
import KanbanBoard from '@/components/kanban/KanbanBoard';

export default function TasksView() {
  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Kanban className="w-7 h-7 text-cyan-400" /> Единая Канбан-матрица
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Сквозная Trello-доска задач по всем проектам: чек-листы, комментарии пользователей и AI-агентов, шкала прогресса, архивирование и Drag &amp; Drop.
          </p>
        </div>
      </div>

      {/* Main Kanban Board with Global Filter */}
      <KanbanBoard showProjectFilter={true} />
    </div>
  );
}
