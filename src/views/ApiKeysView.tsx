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
} from 'lucide-react';
import CreateApiKeyModal from '@/components/CreateApiKeyModal';
import { formatDateTime } from '@/lib/utils';

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

export interface ApiKeysViewProps {
  mcpExtensionSlot?: React.ReactNode;
}

export default function ApiKeysView({ mcpExtensionSlot }: ApiKeysViewProps) {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

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
    } catch (err: any) {
      setUserCreateError(err.message);
    } finally {
      setIsCreatingUser(false);
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

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  useEffect(() => {
    fetchKeys();
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
            onClick={() => setIsUserModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Новый пользователь</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-cyan-950/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Сгенерировать ключ</span>
          </button>
        </div>
      </div>

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
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
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
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
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
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                {userCreateError}
              </div>
            )}
            {userCreateSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
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
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Закрыть
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 disabled:opacity-50"
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
