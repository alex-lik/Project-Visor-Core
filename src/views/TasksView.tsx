'use client';

import React, { useState } from 'react';
import { Kanban, User } from 'lucide-react';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import PersonalBoardsKanban from '@/components/kanban/PersonalBoardsKanban';

type TabId = 'projects' | 'personal';

export default function TasksView() {
  const [tab, setTab] = useState<TabId>('projects');

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: 'projects', label: 'Проекты', icon: <Kanban className="w-3.5 h-3.5" /> },
    { id: 'personal', label: 'Личные доски', icon: <User className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Kanban className="w-7 h-7 text-cyan-400" /> Единая Канбан-матрица
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Trello-доски по всем проектам и личные доски (только для вас): чек-листы, комментарии, шкала прогресса,
            архивирование, Drag &amp; Drop и перенос задач/досок между проектами и личным пространством.
          </p>
        </div>
      </div>

      {/* Tabs: project boards vs personal boards */}
      <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
              tab === t.id
                ? t.id === 'personal'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'projects' ? (
        <KanbanBoard showProjectFilter={true} />
      ) : (
        <PersonalBoardsKanban />
      )}
    </div>
  );
}
