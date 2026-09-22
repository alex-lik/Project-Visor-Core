'use client';

import React, { useState, useEffect } from 'react';
import { X, KeyRound, Copy, Check, Shield, AlertTriangle } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

interface ProjectOption {
  id: string;
  title: string;
}

export default function CreateApiKeyModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [name, setName] = useState('');
  // F-07: Default to 'all_projects' so key generation succeeds immediately without empty scoped selection error
  const [roleScope, setRoleScope] = useState<'all_projects' | 'scoped_projects'>('all_projects');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [canWriteKanban, setCanWriteKanban] = useState(true);
  const [canUpdateStatus, setCanUpdateStatus] = useState(true);
  const [canViewInfra, setCanViewInfra] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState('90');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCreatedKey(null);
      setCopied(false);
      fetch('/api/projects')
        .then((r) => r.json())
        .then((d) => {
          if (d.projects) setProjects(d.projects);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleProject = (id: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleCopy = async () => {
    if (createdKey) {
      const success = await copyToClipboard(createdKey);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roleScope === 'scoped_projects' && selectedProjectIds.length === 0) {
      setError('Выберите хотя бы один проект для ограниченного ключа');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          roleScope,
          allowedProjectIds: roleScope === 'scoped_projects' ? selectedProjectIds : [],
          canWriteKanban,
          canUpdateStatus,
          canViewInfra,
          expiresInDays: expiresInDays ? Number(expiresInDays) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания ключа');

      setCreatedKey(data.rawKey);
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">
              {createdKey ? 'Ключ успешно создан' : 'Выпустить API-ключ для AI-агента'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdKey ? (
          <div className="p-6 space-y-5">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <Shield className="w-4 h-4" /> Секретный токен для подключения
              </div>
              <p className="text-xs text-slate-300">
                Скопируйте этот токен прямо сейчас. В целях безопасности он больше никогда не будет показан в открытом виде!
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-700 rounded-lg">
              <code className="flex-1 font-mono text-xs text-cyan-300 break-all select-all">{createdKey}</code>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Скопировано!' : 'Копировать'}
              </button>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium"
              >
                Готово, я сохранил ключ
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs font-mono">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Назначение / Имя агента <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="например: Claude Desktop Assistant, DevOps CI Bot"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Область доступа к проектам (Scope)</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRoleScope('scoped_projects')}
                  className={`p-3 rounded-lg border text-left transition-all text-xs ${
                    roleScope === 'scoped_projects'
                      ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="font-semibold text-white mb-0.5">🔒 Выборочные проекты</div>
                  <div>Агент видит только отмеченные галочками проекты</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRoleScope('all_projects')}
                  className={`p-3 rounded-lg border text-left transition-all text-xs ${
                    roleScope === 'all_projects'
                      ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="font-semibold text-white mb-0.5">🌐 Все проекты</div>
                  <div>Доступ ко всем проектам в системе</div>
                </button>
              </div>
            </div>

            {roleScope === 'scoped_projects' && (
              <div className="space-y-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <div className="text-xs font-medium text-slate-300 mb-1">Разрешенные проекты:</div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {projects.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-800/60 cursor-pointer text-xs text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(p.id)}
                        onChange={() => toggleProject(p.id)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-950"
                      />
                      <span>{p.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="block text-xs font-medium text-slate-300">Разрешения для агента:</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canWriteKanban}
                    onChange={(e) => setCanWriteKanban(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-950"
                  />
                  <span>Разрешить создание и перемещение задач в Канбане</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canUpdateStatus}
                    onChange={(e) => setCanUpdateStatus(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-950"
                  />
                  <span>Разрешить изменение статусов проектов (Idea ➔ Dev ➔ Staging ➔ Prod)</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canViewInfra}
                    onChange={(e) => setCanViewInfra(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0 bg-slate-950"
                  />
                  <span>Разрешить просмотр информации об инфраструктуре (сервера, IP, порты)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Срок действия (дней)</label>
              <input
                type="number"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="90"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm font-mono"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-sm">
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 font-semibold text-sm shadow-lg shadow-emerald-500/20 transition-all"
              >
                {loading ? 'Генерация...' : 'Сгенерировать ключ'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
