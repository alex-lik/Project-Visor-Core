'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Server, Code, Layers, KeyRound, AlertTriangle } from 'lucide-react';
import { SECRETS_TYPE_LABELS } from '@/lib/utils';
import { ProjectContainer } from '@/lib/containers';
import AddonSpoiler from '@/components/AddonSpoiler';
import ContainerCards from '@/components/ContainerCards';

interface HostOption {
  id: string;
  name: string;
}

export default function CreateProjectModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [hosts, setHosts] = useState<HostOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('saas');
  const [status, setStatus] = useState('in_dev');
  const [priority, setPriority] = useState('medium');
  const [hostId, setHostId] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('nextjs, docker, postgres');

  // Deployment options
  const [runtimeType, setRuntimeType] = useState('docker_compose');
  const [deployAutomation, setDeployAutomation] = useState('github_actions');
  const [containers, setContainers] = useState<ProjectContainer[]>([
    {
      id: 'c_1',
      name: 'web',
      type: 'web',
      containerName: '',
      port: 3000,
      portType: 'http',
      isPublic: true,
    },
  ]);

  const addContainer = (preset?: Partial<ProjectContainer>) => {
    const id = `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setContainers((prev) => [
      ...prev,
      {
        id,
        name: preset?.name || `service_${prev.length + 1}`,
        type: preset?.type || 'api',
        containerName: preset?.containerName || '',
        port: preset?.port !== undefined ? preset.port : 8080,
        portType: preset?.portType || 'http',
        isPublic: preset?.isPublic ?? true,
      },
    ]);
  };

  const updateContainer = (id: string, field: keyof ProjectContainer, val: any) => {
    setContainers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: val } : c))
    );
  };

  const removeContainer = (id: string) => {
    if (containers.length <= 1) return;
    setContainers((prev) => prev.filter((c) => c.id !== id));
  };

  const [deployCommand, setDeployCommand] = useState('docker compose up -d --build');
  const [envKeysHint, setEnvKeysHint] = useState('');
  const [secretsType, setSecretsType] = useState('dotenv');
  const [secretsPathOrUri, setSecretsPathOrUri] = useState('');

  // Addons & Infrastructure Attachments (пусто по умолчанию — спойлеры свёрнуты)
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [backupSchedule, setBackupSchedule] = useState('');
  const [backupTool, setBackupTool] = useState('');
  const [backupDestination, setBackupDestination] = useState('');
  const [storageProvider, setStorageProvider] = useState('cloudflare_r2');
  const [storageBucket, setStorageBucket] = useState('');
  const [storageEndpoint, setStorageEndpoint] = useState('');
  const [ftpHost, setFtpHost] = useState('');
  const [ftpPort, setFtpPort] = useState('22');
  const [ftpUser, setFtpUser] = useState('');
  const [ftpPath, setFtpPath] = useState('');
  const [sentryProject, setSentryProject] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/hosts')
        .then((r) => r.json())
        .then((data) => {
          if (data.hosts) setHosts(data.hosts);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          status,
          priority,
          hostId: hostId || null,
          repoUrl: repoUrl || null,
          publicUrl: publicUrl || null,
          description,
          tags,
          deployment: {
            runtimeType,
            deployAutomation,
            containers,
            internalPort: containers[0]?.port ? Number(containers[0].port) : null,
            containerName: containers[0]?.containerName || containers[0]?.name || null,
            deployCommand: deployCommand || null,
            envKeysHint: envKeysHint || null,
            secretsType,
            secretsPathOrUri: secretsPathOrUri || null,
            backupEnabled,
            backupSchedule: backupEnabled ? backupSchedule : null,
            backupTool: backupEnabled ? backupTool : null,
            backupDestination: backupEnabled ? backupDestination : null,
            storageProvider: storageBucket ? storageProvider : null,
            storageBucket: storageBucket || null,
            storageEndpoint: storageEndpoint || null,
            ftpHost: ftpHost || null,
            ftpPort: ftpPort ? Number(ftpPort) : 22,
            ftpUser: ftpUser || null,
            ftpPath: ftpPath || null,
            sentryProject: sentryProject || null,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка при сохранении');
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Plus className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white">Добавить новый проект</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-semibold flex items-center gap-2">
              <Code className="w-4 h-4" /> 1. Основные сведения
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Название проекта <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="например: AI Customer Support Bot"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Категория</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm"
                >
                  <option value="saas">🚀 SaaS Платформа / Сервис</option>
                  <option value="bot">🤖 Бот (Telegram/Discord)</option>
                  <option value="website">🌐 Веб-сайт / Лендинг</option>
                  <option value="crm">📊 CRM / Админка</option>
                  <option value="api">🔌 REST API / Backend</option>
                  <option value="script">⚙️ Скрипт / Парсер</option>
                  <option value="system">🖥️ Системная служба</option>
                  <option value="idea">💡 Идея / Исследование</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Статус</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm"
                >
                  <option value="idea">💡 Идея</option>
                  <option value="backlog">📋 В бэклоге</option>
                  <option value="in_dev">🟡 В разработке</option>
                  <option value="staging">🔵 Staging / Тест</option>
                  <option value="production">🟢 Production</option>
                  <option value="paused">🟠 Приостановлен</option>
                  <option value="archived">⚪ В архиве</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Приоритет</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm"
                >
                  <option value="low">Низкий</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                  <option value="critical">Критический 🔥</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Краткое описание / Задачи</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Что делает проект, какую проблему решает..."
                className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">URL Репозитория (Git)</label>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Публичный URL / Домен</label>
                <input
                  type="url"
                  value={publicUrl}
                  onChange={(e) => setPublicUrl(e.target.value)}
                  placeholder="https://app.myproject.com"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Теги стека (через запятую)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="nextjs, docker, kubernetes, postgres"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm font-mono"
              />
            </div>
          </div>

          {/* Section 2: Hosting & Deployment */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs uppercase font-mono tracking-wider text-indigo-400 font-semibold flex items-center gap-2">
              <Server className="w-4 h-4" /> 2. Инфраструктура, Оркестрация и CI/CD
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Сервер / Кластер размещения</label>
              <select
                value={hostId}
                onChange={(e) => setHostId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm"
              >
                <option value="">Не привязан к серверу / Cloud / Локально</option>
                {hosts.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Среда / Оркестратор (Runtime)</label>
                <select
                  value={runtimeType}
                  onChange={(e) => setRuntimeType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm font-mono"
                >
                  <option value="docker_compose">Docker Compose</option>
                  <option value="docker_standalone">Docker Standalone Container</option>
                  <option value="kubernetes">☸️ Kubernetes (K8s Pod / Deployment)</option>
                  <option value="docker_swarm">🐳 Docker Swarm Service</option>
                  <option value="coolify_portainer">📦 Coolify / Portainer Stack</option>
                  <option value="systemd_service">⚙️ Systemd Service</option>
                  <option value="pm2">🚀 PM2 Daemon</option>
                  <option value="cron">⏰ Cron Script</option>
                  <option value="nomad">HashiCorp Nomad</option>
                  <option value="serverless">⚡ Serverless / Cloudflare Worker</option>
                  <option value="manual">Manual Exec</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">CI/CD & Автоматизация</label>
                <select
                  value={deployAutomation}
                  onChange={(e) => setDeployAutomation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm font-mono"
                >
                  <option value="github_actions">GitHub Actions (CI/CD)</option>
                  <option value="jenkins">👨‍✈️ Jenkins Pipeline</option>
                  <option value="gitlab_ci">🦊 GitLab CI/CD</option>
                  <option value="argocd">🐙 ArgoCD GitOps</option>
                  <option value="webhook">🪝 Webhook Trigger</option>
                  <option value="manual_ssh">🔑 Ручной вход по SSH</option>
                  <option value="local_script">📜 Локальный bash-скрипт</option>
                </select>
              </div>
            </div>

            {/* Containers: compact cards grid */}
            <div className="pt-2">
              <ContainerCards
                containers={containers}
                onAdd={addContainer}
                onUpdate={updateContainer}
                onRemove={removeContainer}
                title="Контейнеры и порты сервиса"
                description="Добавьте контейнеры проекта с указанием типа сервиса (API, Web, БД, Кэш, Воркер) и протокола."
                addLabel="Добавить сервис"
                minCount={1}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Команда деплоя / манифест</label>
              <input
                type="text"
                value={deployCommand}
                onChange={(e) => setDeployCommand(e.target.value)}
                placeholder="kubectl apply -f k8s/ или docker compose up -d"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm font-mono"
              />
            </div>
          </div>

          {/* Section 3: Addons — collapsible spoilers, collapsed when empty */}
          <div className="space-y-2.5 pt-4 border-t border-slate-800">
            <h3 className="text-xs uppercase font-mono tracking-wider text-emerald-400 font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4" /> 3. Полезный обвес: Бэкапы, S3/R2 Хранилище, FTP & Sentry
            </h3>

            {/* Backups */}
            <AddonSpoiler
              icon="💾"
              title="Автоматические бэкапы"
              hint="Расписание, утилита и назначение"
              hasData={backupEnabled || Boolean(backupSchedule.trim() || backupTool.trim() || backupDestination.trim())}
              activeLabel={backupEnabled ? 'Включено' : 'Настроено'}
            >
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backupEnabled}
                  onChange={(e) => setBackupEnabled(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-0 bg-slate-950"
                />
                <span className="text-xs font-semibold text-white">Прикрутить автоматические бэкапы</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-mono">Расписание (Cron)</label>
                  <input
                    type="text"
                    value={backupSchedule}
                    onChange={(e) => setBackupSchedule(e.target.value)}
                    placeholder="Ежедневно в 03:00 (0 3 * * *)"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-mono">Утилита бэкапа</label>
                  <input
                    type="text"
                    value={backupTool}
                    onChange={(e) => setBackupTool(e.target.value)}
                    placeholder="pg_dumpall + GPG, restic, borg"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-mono">Куда сливать (Destination)</label>
                  <input
                    type="text"
                    value={backupDestination}
                    onChange={(e) => setBackupDestination(e.target.value)}
                    placeholder="Cloudflare R2 / S3 'backups'"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
              </div>
            </AddonSpoiler>

            {/* Object Storage (S3 / Cloudflare R2) */}
            <AddonSpoiler
              icon="🗄️"
              title="Объектное хранилище (S3 / Cloudflare R2)"
              hint="Провайдер, бакет и endpoint"
              hasData={Boolean(storageBucket.trim() || storageEndpoint.trim())}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-mono">Провайдер S3</label>
                  <select
                    value={storageProvider}
                    onChange={(e) => setStorageProvider(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  >
                    <option value="cloudflare_r2">Cloudflare R2</option>
                    <option value="aws_s3">AWS S3</option>
                    <option value="minio">MinIO (Self-hosted)</option>
                    <option value="yandex_s3">Yandex Object Storage</option>
                    <option value="selectel">Selectel S3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-mono">Имя бакета (Bucket Name)</label>
                  <input
                    type="text"
                    value={storageBucket}
                    onChange={(e) => setStorageBucket(e.target.value)}
                    placeholder="my-saas-media"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-mono">Endpoint (URL)</label>
                  <input
                    type="text"
                    value={storageEndpoint}
                    onChange={(e) => setStorageEndpoint(e.target.value)}
                    placeholder="https://...r2.cloudflarestorage.com"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
              </div>
            </AddonSpoiler>

            {/* FTP / SFTP */}
            <AddonSpoiler
              icon="📁"
              title="FTP / SFTP доступ"
              hint="Для медиа или синхронизации"
              hasData={Boolean(ftpHost.trim() || ftpUser.trim() || ftpPath.trim())}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-1 font-mono">Хост FTP / IP</label>
                  <input
                    type="text"
                    value={ftpHost}
                    onChange={(e) => setFtpHost(e.target.value)}
                    placeholder="ftp.myserver.com"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-mono">Порт</label>
                  <input
                    type="number"
                    value={ftpPort}
                    onChange={(e) => setFtpPort(e.target.value)}
                    placeholder="22"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-mono">Логин (User)</label>
                  <input
                    type="text"
                    value={ftpUser}
                    onChange={(e) => setFtpUser(e.target.value)}
                    placeholder="deployer"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-mono">Путь (Path)</label>
                <input
                  type="text"
                  value={ftpPath}
                  onChange={(e) => setFtpPath(e.target.value)}
                  placeholder="/uploads или /var/www/media"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
            </AddonSpoiler>

            {/* Sentry / Error Monitoring */}
            <AddonSpoiler
              icon="🛡️"
              title="Трекинг ошибок (Sentry / GlitchTip)"
              hint="Проект или DSN-подсказка"
              hasData={Boolean(sentryProject.trim())}
            >
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-mono">Проект / DSN подсказка</label>
                <input
                  type="text"
                  value={sentryProject}
                  onChange={(e) => setSentryProject(e.target.value)}
                  placeholder="sentry-my-project или DSN hint"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
            </AddonSpoiler>
          </div>

          {/* Section 4: Secrets Management */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h3 className="text-xs uppercase font-mono tracking-wider text-amber-400 font-semibold flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> 4. Управление секретами & Переменными
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                  Тип хранения секретов
                </label>
                <select
                  value={secretsType}
                  onChange={(e) => setSecretsType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-500 text-sm font-mono"
                >
                  <option value="dotenv">📄 Файл .env / System Env</option>
                  <option value="vault">🔐 HashiCorp Vault</option>
                  <option value="k8s_secrets">☸️ Kubernetes Secrets</option>
                  <option value="docker_secrets">🐳 Docker Secrets (/run/secrets)</option>
                  <option value="doppler_infisical">🔑 Doppler / Infisical</option>
                  <option value="aws_secrets">☁️ Cloud Secrets (AWS / GCP / Cloud)</option>
                  <option value="cicd_secrets">🐙 CI/CD Secrets (GitHub/GitLab)</option>
                  <option value="hardcode">⚠️ В коде / Хардкод (небезопасно)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                  Путь / Vault Mount / Имя Secret
                </label>
                <input
                  type="text"
                  value={secretsPathOrUri}
                  onChange={(e) => setSecretsPathOrUri(e.target.value)}
                  placeholder={SECRETS_TYPE_LABELS[secretsType]?.placeholder || 'Путь или имя секрета'}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm font-mono"
                />
              </div>
            </div>

            {secretsType === 'hardcode' && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Внимание: хранение секретов в исходном коде или git-репозитории создает высокий риск утечки! Рекомендуется мигрировать на .env файл, Vault или Kubernetes Secrets.
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                Список необходимых .env ключей (без паролей и значений!)
              </label>
              <input
                type="text"
                value={envKeysHint}
                onChange={(e) => setEnvKeysHint(e.target.value)}
                placeholder="BOT_TOKEN, DATABASE_URL, REDIS_PORT, SECRET_KEY"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                Только названия переменных для памятки и чек-листа деплоя (значения не сохраняются в Visor).
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-sm transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium text-sm shadow-lg shadow-cyan-500/25 transition-all disabled:opacity-50"
            >
              {loading ? 'Создание...' : 'Создать проект'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
