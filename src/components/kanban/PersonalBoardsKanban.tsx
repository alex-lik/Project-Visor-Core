'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  FolderInput,
  X,
} from 'lucide-react';
import KanbanBoard from '@/components/kanban/KanbanBoard';

interface PersonalBoardView {
  id: string;
  kind: string;
  title: string;
  ownerId: string | null;
  tasksCount?: number;
}

interface ProjectOption {
  id: string;
  title: string;
}

/**
 * Личные канбан-доски пользователя: свой набор досок (kind='personal'),
 * вне контекста проектов. Поддерживает создание/переименование/удаление
 * досок и перенос доски целиком на любой проект.
 */
export default function PersonalBoardsKanban() {
  const [boards, setBoards] = useState<PersonalBoardView[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Create / rename
  const [creating, setCreating] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  // Move to project
  const [moveBoardId, setMoveBoardId] = useState<string | null>(null);
  const [moveProjectId, setMoveProjectId] = useState('');
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  const fetchBoards = useCallback(async () => {
    setLoading(true);
    try {
      const [boardsRes, projRes] = await Promise.all([
        fetch('/api/kanban/boards?kind=personal'),
        fetch('/api/projects'),
      ]);
      if (boardsRes.ok) {
        const data = await boardsRes.json();
        const list: PersonalBoardView[] = data.boards || [];
        setBoards(list);
        setSelectedBoardId((prev) => (prev && list.some((b) => b.id === prev) ? prev : list[0]?.id || null));
      }
      if (projRes.ok) {
        const data = await projRes.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Failed to fetch personal boards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newBoardTitle.trim();
    if (!title) return;
    setError('');
    try {
      const res = await fetch('/api/kanban/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Не удалось создать доску');
        return;
      }
      setNewBoardTitle('');
      setCreating(false);
      await fetchBoards();
      if (data?.board?.id) {
        setSelectedBoardId(data.board.id);
      }
    } catch (err) {
      setError('Не удалось создать доску');
    }
  };

  const handleRenameBoard = async (boardId: string) => {
    const title = renameTitle.trim();
    if (!title) return;
    try {
      const res = await fetch(`/api/kanban/boards/${boardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        setRenamingBoardId(null);
        await fetchBoards();
      }
    } catch (err) {
      console.error('Failed to rename board:', err);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    if (!confirm('Удалить личную доску вместе со всеми её задачами? Действие необратимо.')) return;
    try {
      const res = await fetch(`/api/kanban/boards/${boardId}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedBoardId === boardId) {
          setSelectedBoardId(null);
        }
        await fetchBoards();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || 'Не удалось удалить доску');
      }
    } catch (err) {
      console.error('Failed to delete board:', err);
    }
  };

  const handleMoveToProject = async (boardId: string) => {
    if (!moveProjectId) {
      setError('Выберите целевой проект');
      return;
    }
    setMoving(true);
    setError('');
    try {
      const res = await fetch(`/api/kanban/boards/${boardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move_to_project', projectId: moveProjectId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Не удалось перенести доску на проект');
        return;
      }
      setMoveBoardId(null);
      setMoveProjectId('');
      setSelectedBoardId(null);
      await fetchBoards();
    } catch (err) {
      setError('Не удалось перенести доску на проект');
    } finally {
      setMoving(false);
    }
  };

  const selectedBoard = boards.find((b) => b.id === selectedBoardId) || null;
  const moveTargetBoard = boards.find((b) => b.id === moveBoardId) || null;

  return (
    <div className="space-y-4">
      {/* Board Tabs + Create */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <User className="w-4 h-4 text-indigo-400 shrink-0" />
          {loading ? (
            <span className="text-xs font-mono text-slate-500 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Загрузка досок...
            </span>
          ) : boards.length === 0 ? (
            <span className="text-xs font-mono text-slate-500">У вас пока нет личных досок</span>
          ) : (
            boards.map((b) => (
              <div
                key={b.id}
                className={`group flex items-center rounded-xl border transition-colors ${
                  selectedBoardId === b.id
                    ? 'bg-indigo-500/20 border-indigo-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                {renamingBoardId === b.id ? (
                  <input
                    autoFocus
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameBoard(b.id);
                      if (e.key === 'Escape') setRenamingBoardId(null);
                    }}
                    onBlur={() => handleRenameBoard(b.id)}
                    className="px-3 py-1.5 bg-transparent text-xs font-semibold text-white focus:outline-none max-w-[180px]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedBoardId(b.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 max-w-[220px] truncate"
                    title={`${b.title} · задач: ${b.tasksCount || 0}`}
                  >
                    <span className="truncate">{b.title}</span>
                    <span className={`px-1.5 py-0 rounded-full text-[10px] font-mono ${selectedBoardId === b.id ? 'text-indigo-300' : 'text-slate-500'}`}>
                      {b.tasksCount || 0}
                    </span>
                  </button>
                )}
                {/* Rename / delete on hover */}
                <div className="flex items-center pr-1.5 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingBoardId(b.id);
                      setRenameTitle(b.title);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-cyan-300 hover:bg-slate-900 transition-colors"
                    title="Переименовать доску"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMoveBoardId(b.id);
                      setMoveProjectId('');
                      setError('');
                    }}
                    className="p-1 rounded text-slate-500 hover:text-emerald-300 hover:bg-slate-900 transition-colors"
                    title="Перенести доску на проект"
                  >
                    <FolderInput className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBoard(b.id);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                    title="Удалить доску"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {creating ? (
            <form onSubmit={handleCreateBoard} className="flex items-center gap-2">
              <input
                autoFocus
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
                placeholder="Название личной доски..."
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-indigo-500/50 text-xs text-white placeholder-slate-500 focus:outline-none w-52"
              />
              <button
                type="submit"
                disabled={!newBoardTitle.trim()}
                className="px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-bold text-xs transition-colors"
              >
                Создать
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setNewBoardTitle('');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Новая личная доска</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-mono">{error}</div>
      )}

      {/* Move-to-project modal */}
      {moveBoardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <FolderInput className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Перенести доску на проект</h2>
                  <p className="text-xs text-slate-400 truncate max-w-[320px]">
                    «{moveTargetBoard?.title}» станет проектной доской выбранного проекта.
                  </p>
                </div>
              </div>
              <button onClick={() => setMoveBoardId(null)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Целевой проект</label>
                <select
                  value={moveProjectId}
                  onChange={(e) => setMoveProjectId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm"
                >
                  <option value="">— выберите проект —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Все задачи доски станут задачами выбранного проекта. У проекта уже должна быть свободная доска —
                если у него есть своя доска, перенос будет заблокирован.
              </p>
              <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMoveBoardId(null)}
                  className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-xs"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveToProject(moveBoardId!)}
                  disabled={!moveProjectId || moving}
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors"
                >
                  {moving ? 'Перенос...' : 'Перенести'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected board */}
      {selectedBoard ? (
        <KanbanBoard
          key={selectedBoard.id}
          boardId={selectedBoard.id}
          boardTitle={selectedBoard.title}
          showProjectFilter={false}
          onTasksChange={fetchBoards}
        />
      ) : (
        !loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-3 border border-dashed border-slate-800 rounded-2xl text-center">
            <User className="w-12 h-12 text-slate-700" />
            <div className="text-sm font-semibold text-slate-300">Создайте личную доску</div>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              Личные доски видны только вам — для своих задач вне проектов. Можно создавать несколько досок,
              переносить туда задачи из любых проектов и переносить сами доски обратно на проекты.
            </p>
          </div>
        )
      )}
    </div>
  );
}
