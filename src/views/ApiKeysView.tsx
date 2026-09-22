'use client';

import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  Shield,
  Terminal,
  Code2,
  UserPlus,
  Users,
  ShieldCheck,
  RefreshCw,
  UserCog,
} from 'lucide-react';
import CreateApiKeyModal from '@/components/CreateApiKeyModal';
import { formatDateTime, formatDate, copyToClipboard as copyUtil } from '@/lib/utils';

interface ApiKeyItem {
  id: string;
  name: string;
  userId?: string;
  ownerUsername?: string;
  isMyKey?: boolean;
  keyPrefix: string;
  roleScope: string;
  allowedProjectNames: string[];
  canWriteKanban: boolean;
  canUpdateStatus: boolean;
  canViewInfra: boolean;
  createdAt: number;
  lastUsedAt?: number;
}

interface UserItem {
  id: string;
  username: string;
  email?: string | null;
  role: string;
  createdAt: number;
}

export interface ApiKeysViewProps {
  mcpExtensionSlot?: React.ReactNode;
}

export default function ApiKeysView({ mcpExtensionSlot }: ApiKeysViewProps) {
  const [activeTab, setActiveTab] = useState<'api_keys' | 'users'>('api_keys');
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Users list
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // User management modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('viewer');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userCreateError, setUserCreateError] = useState('');
  const [userCreateSuccess, setUserCreateSuccess] = useState('');

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/api-keys');
      const data = await res.json();
      if (data.keys) setKeys(data.keys);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (data.users) setUsersList(data.users);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    setUserCreateError('');
    setUserCreateSuccess('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newUserRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания пользователя');
      setUserCreateSuccess(`Пользователь @${newUsername} успешно зарегистрирован!`);
      setNewUsername('');
      setNewPassword('');
      fetchUsers();
    } catch (err: any) {
      setUserCreateError(err.message);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'viewer' : 'admin';
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка смены роли');
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Удалить пользователя @${username}?`)) return;
    try {
      const res = await fetch(`/api/users?userId=${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка удаления пользователя');
        return;
      }
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteKey = async (id: string, name: string) => {
    if (!confirm(`Отозвать API-ключ "${name}"? Любые скрипты с этим ключом потеряют доступ.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Ошибка отзыва ключа');
      fetchKeys();
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = async (text: string, sectionId: string) => {
    const ok = await copyUtil(text);
    if (ok) {
      setCopiedSection(sectionId);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchUsers();
  }, []);

  const curlExample = `curl -X GET "http://localhost:3000/api/projects" \\
  -H "Authorization: Bearer pv_live_YOUR_KEY"`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <KeyRound className="w-6 h-6 text-cyan-400" />
            API-ключи & Управление доступом
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Токены для автоматизации, CLI, внешних скриптов и пользователей платформы
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setUserCreateError('');
              setUserCreateSuccess('');
              setIsUserModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Новый пользователь</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-cyan-950/40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Сгенерировать ключ</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('api_keys')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'api_keys'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>API-ключи</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {keys.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('users');
            fetchUsers();
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'users'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Пользователи платформы</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {usersList.length}
          </span>
        </button>
      </div>

      {activeTab === 'api_keys' ? (
        <>
          {/* Keys List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Активные API-ключи</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {keys.length}
                </span>
              </h2>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">Загрузка ключей...</div>
            ) : keys.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-800 bg-[#0c121e]/40 text-center">
                <KeyRound className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <div className="text-sm font-semibold text-slate-300">Нет активных API-ключей</div>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Создайте первый ключ для автоматизации задач и обращения к API Core.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {keys.map((k) => (
                  <div
                    key={k.id}
                    className="p-5 rounded-2xl border border-slate-800/80 bg-[#0c121e]/90 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            {k.name}
                            {k.ownerUsername && (
                              <span className="text-[10px] font-mono font-normal text-slate-400 bg-slate-850 px-1.5 py-0.5 rounded border border-slate-750">
                                @{k.ownerUsername}
                              </span>
                            )}
                          </h3>
                          <div className="text-[11px] font-mono text-cyan-400/90 mt-1">
                            Префикс: {k.keyPrefix}••••••••
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteKey(k.id, k.name)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="Отозвать ключ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Scopes & Permissions */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          {k.roleScope === 'all_projects' ? 'Все проекты' : 'Ограниченный доступ'}
                        </span>
                        {k.canWriteKanban && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                            Запись задач
                          </span>
                        )}
                        {k.canUpdateStatus && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
                            Смена статусов
                          </span>
                        )}
                        {k.canViewInfra && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
                            Инфраструктура
                          </span>
                        )}
                      </div>

                      {k.roleScope === 'scoped_projects' && k.allowedProjectNames && k.allowedProjectNames.length > 0 && (
                        <div className="text-[11px] text-slate-400 mt-2 font-mono">
                          Проекты: {k.allowedProjectNames.join(', ')}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>Создан: {formatDateTime(k.createdAt)}</span>
                      <span>{k.lastUsedAt ? `Исп.: ${formatDateTime(k.lastUsedAt)}` : 'Не использовался'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Integration Guide Box */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-[#0c121e]/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Использование API в скриптах и CI/CD</h3>
                  <p className="text-xs text-slate-400">
                    Передавайте сгенерированный токен в заголовке Authorization Bearer
                  </p>
                </div>
              </div>

              <button
                onClick={() => copyToClipboard(curlExample, 'curl')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedSection === 'curl' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Скопировать cURL</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
              {curlExample}
            </pre>
          </div>

          {/* Optional MCP Extension Slot */}
          {mcpExtensionSlot}
        </>
      ) : (
        /* Users Management Tab (F-10) */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Зарегистрированные пользователи</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {usersList.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Управление учетными записями, ролями доступа и правами
              </p>
            </div>

            <button
              onClick={() => {
                setUserCreateError('');
                setUserCreateSuccess('');
                setIsUserModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Создать пользователя</span>
            </button>
          </div>

          {loadingUsers ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">Загрузка пользователей...</div>
          ) : usersList.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-slate-800 bg-[#0c121e]/40 text-center">
              <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-300">Список пользователей пуст</div>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-2xl overflow-hidden bg-[#0c121e]/90 shadow">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                  <tr>
                    <th className="p-4">Пользователь</th>
                    <th className="p-4">Роль</th>
                    <th className="p-4">Дата регистрации</th>
                    <th className="p-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {usersList.map((u) => {
                    const isAdmin = u.role === 'admin';
                    return (
                      <tr key={u.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-4 font-mono font-medium text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs font-bold">
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-200">@{u.username}</span>
                            {u.email && <div className="text-[10px] text-slate-500">{u.email}</div>}
                          </div>
                        </td>
                        <td className="p-4 font-mono">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                              isAdmin
                                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/50'
                                : 'bg-slate-850 text-slate-400 border-slate-750'
                            }`}
                          >
                            {isAdmin ? 'Администратор (Full)' : 'Viewer (Только чтение)'}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-400">
                          {formatDate(u.createdAt)}
                        </td>
                        <td className="p-4 text-right space-x-2 font-mono">
                          <button
                            type="button"
                            onClick={() => handleToggleRole(u.id, u.role)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition-colors cursor-pointer"
                            title="Изменить роль"
                          >
                            {isAdmin ? 'Сделать Viewer' : 'Сделать Admin'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                            title="Удалить пользователя"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateApiKeyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchKeys}
      />

      {/* User Creation Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0c121e] border border-slate-800 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-cyan-400" />
              Регистрация пользователя в Control Plane
            </h3>

            {userCreateError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-mono">
                {userCreateError}
              </div>
            )}
            {userCreateSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono">
                {userCreateSuccess}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Логин</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="developer"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#090d16] border border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Пароль</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#090d16] border border-slate-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Роль</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#090d16] border border-slate-800 text-xs text-white"
                >
                  <option value="viewer">Viewer (только просмотр)</option>
                  <option value="admin">Admin (полный доступ)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Закрыть
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingUser ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
