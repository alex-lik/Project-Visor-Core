'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Server,
  FolderGit2,
  ExternalLink,
  GitBranch,
  Terminal,
  Kanban,
  Network,
  Activity,
  FileText,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  Edit3,
  Bot,
  Globe,
  Layers,
  Cpu,
  ShieldAlert,
  KeyRound,
  Lock,
  AlertTriangle,
  Users,
  UserPlus,
  UserMinus,
  Crown,
  ShieldCheck,
  Zap,
  Play,
  FileCode,
  Sparkles,
  Code,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Pause,
  Square,
  Sliders,
  Folder,
} from 'lucide-react';
import { STATUS_COLORS, RUNTIME_LABELS, RELATION_LABELS, SECRETS_TYPE_LABELS, formatDateTime } from '@/lib/utils';
import {
  ProjectContainer,
  normalizeContainers,
} from '@/lib/containers';
import AddonSpoiler from '@/components/AddonSpoiler';
import ContainerCards from '@/components/ContainerCards';
import CreateTaskModal from '@/components/CreateTaskModal';
import CreateRelationModal from '@/components/CreateRelationModal';
import EditProjectModal from '@/components/EditProjectModal';
import OpenCodeChat from '@/components/OpenCodeChat';

export interface ProjectDetailViewProps {
  bannerSlot?: React.ReactNode;
  headerActionSlot?: React.ReactNode;
  params?: Promise<{ id: string }> | { id: string };
}

export default function ProjectDetailView({ bannerSlot, headerActionSlot, params }: ProjectDetailViewProps = {}) {
  const routerParams = useParams();
  const router = useRouter();
  const projectId = (params && 'id' in params && typeof params.id === 'string' ? params.id : routerParams?.id) as string;

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'kanban' | 'relations' | 'telemetry' | 'wiki' | 'members' | 'opencode'>('kanban');

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isRelationModalOpen, setIsRelationModalOpen] = useState(false);
  // Редактирование базовых полей проекта (название, описание, сайт и т.д.)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Project Members & Access State
  const [members, setMembers] = useState<any[]>([]);
  const [ownerInfo, setOwnerInfo] = useState<any>(null);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [allUsersList, setAllUsersList] = useState<any[]>([]);
  const [selectedUserToShare, setSelectedUserToShare] = useState('');
  const [shareRole, setShareRole] = useState('editor');
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState('');

  // Deployment form edit
  const [deployRuntime, setDeployRuntime] = useState('');
  const [deployAutomation, setDeployAutomation] = useState('');
  const [deployPort, setDeployPort] = useState('');
  const [deployContainer, setDeployContainer] = useState('');
  const [deployContainers, setDeployContainers] = useState<ProjectContainer[]>([]);

  const addDeployContainer = (preset?: Partial<ProjectContainer>) => {
    const id = `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setDeployContainers((prev) => [
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

  const updateDeployContainer = (id: string, field: keyof ProjectContainer, val: any) => {
    setDeployContainers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: val } : c))
    );
  };

  const removeDeployContainer = (id: string) => {
    setDeployContainers((prev) => prev.filter((c) => c.id !== id));
  };

  const [deployPath, setDeployPath] = useState('');
  const [deployCommand, setDeployCommand] = useState('');
  const [deployEnvHint, setDeployEnvHint] = useState('');
  const [deployNotes, setDeployNotes] = useState('');
  const [isSavingDeploy, setIsSavingDeploy] = useState(false);

  // Host assignment / migration
  const [allHosts, setAllHosts] = useState<any[]>([]);
  const [selectedHostId, setSelectedHostId] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);

  // Addons state
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
  const [secretsType, setSecretsType] = useState('dotenv');
  const [secretsPathOrUri, setSecretsPathOrUri] = useState('');

  // Wiki notes state
  const [wikiNotes, setWikiNotes] = useState('');
  const [isSavingWiki, setIsSavingWiki] = useState(false);

  // New telemetry target state
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetUrl, setNewTargetUrl] = useState('');
  const [newTargetType, setNewTargetType] = useState('http_ping');
  const [isAddingTarget, setIsAddingTarget] = useState(false);

  // OpenCode Integration State
  const [openCodeRuns, setOpenCodeRuns] = useState<any[]>([]);
  const [openCodePrompt, setOpenCodePrompt] = useState('');
  const [openCodeTitle, setOpenCodeTitle] = useState('');
  const [selectedTaskIdForOpenCode, setSelectedTaskIdForOpenCode] = useState('');
  const [isRunningOpenCode, setIsRunningOpenCode] = useState(false);
  const [openCodeError, setOpenCodeError] = useState('');
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [viewingDiffRunId, setViewingDiffRunId] = useState<string | null>(null);
  const [copiedDiffId, setCopiedDiffId] = useState<string | null>(null);
  const [openCodeHealth, setOpenCodeHealth] = useState<{ healthy?: boolean; version?: string; error?: string } | null>(null);
  const [checkingOpenCodeHealth, setCheckingOpenCodeHealth] = useState(false);
  const [syncingRunId, setSyncingRunId] = useState<string | null>(null);

  // OpenCode Extended Controls
  const [openCodeDirectory, setOpenCodeDirectory] = useState('');
  const [openCodeSessionId, setOpenCodeSessionId] = useState('');
  const [availableSessions, setAvailableSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [openCodeModel, setOpenCodeModel] = useState('');
  const [availableModels, setAvailableModels] = useState<Array<{
    id: string;
    name: string;
    providerId: string;
    providerName: string;
    fullId: string;
    isDefault?: boolean;
  }>>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [openCodeReasoningEffort, setOpenCodeReasoningEffort] = useState<'none' | 'low' | 'medium' | 'high'>('medium');


  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (res.ok) {
        setProject(data);
        setWikiNotes(data.readmeNotes || '');
        if (data.deployment) {
          if (data.deployment.deployPath) {
            setOpenCodeDirectory((prev) => prev || data.deployment.deployPath);
          }
          setDeployRuntime(data.deployment.runtimeType || 'docker_compose');
          setDeployAutomation(data.deployment.deployAutomation || 'manual_ssh');
          setDeployPort(data.deployment.internalPort ? String(data.deployment.internalPort) : '');
          setDeployContainer(data.deployment.containerName || '');
          setDeployContainers(normalizeContainers(data.deployment));
          setDeployPath(data.deployment.deployPath || '');
          setDeployCommand(data.deployment.deployCommand || '');
          setDeployEnvHint(data.deployment.envKeysHint || '');
          setDeployNotes(data.deployment.notes || '');
          setBackupEnabled(Boolean(data.deployment.backupEnabled));
          setBackupSchedule(data.deployment.backupSchedule || '0 3 * * *');
          setBackupTool(data.deployment.backupTool || 'pg_dumpall + GPG');
          setBackupDestination(data.deployment.backupDestination || "Cloudflare R2 Bucket 'backups'");
          setStorageProvider(data.deployment.storageProvider || 'cloudflare_r2');
          setStorageBucket(data.deployment.storageBucket || '');
          setStorageEndpoint(data.deployment.storageEndpoint || '');
          setFtpHost(data.deployment.ftpHost || '');
          setFtpPort(data.deployment.ftpPort ? String(data.deployment.ftpPort) : '22');
          setFtpUser(data.deployment.ftpUser || '');
          setFtpPath(data.deployment.ftpPath || '');
          setSentryProject(data.deployment.sentryProject || '');
          setSecretsType(data.deployment.secretsType || 'dotenv');
          setSecretsPathOrUri(data.deployment.secretsPathOrUri || '');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members || []);
        setOwnerInfo(data.owner || null);
        setCanManageMembers(Boolean(data.canManage));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHostsList = async () => {
    try {
      const res = await fetch('/api/hosts');
      const data = await res.json();
      if (data.hosts) setAllHosts(data.hosts);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMigrateHost = async () => {
    const nextHostId = selectedHostId || null;
    const prevHostId = project?.hostId || null;
    if (nextHostId === prevHostId) {
      alert('Сервер не изменился — миграция не требуется.');
      return;
    }
    const targetHost = allHosts.find((h: any) => h.id === nextHostId);
    const ok = confirm(
      nextHostId
        ? `Перенести проект "${project?.title}" на сервер "${targetHost?.name || nextHostId}"? Чек-лист: обновите Путь к проекту, проверьте порты на конфликты, .env/секреты, health-таргеты и OpenCode на новом хосте.`
        : `Отвязать проект "${project?.title}" от сервера? OpenCode-запуски будут недоступны до привязки.`
    );
    if (!ok) return;
    setIsMigrating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: nextHostId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка миграции');
      await fetchProject();
      alert(nextHostId ? 'Проект перенесен на новый сервер.' : 'Проект отвязан от сервера.');
    } catch (err: any) {
      alert(err.message || 'Ошибка миграции');
    } finally {
      setIsMigrating(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.users) setAllUsersList(data.users);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOpenCodeRuns = async () => {
    try {
      const res = await fetch(`/api/opencode/runs?projectId=${projectId}`);
      const data = await res.json();
      if (data.runs) setOpenCodeRuns(data.runs);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOpenCodeSessions = async (hostIdOverride?: string) => {
    const targetHostId = hostIdOverride || project?.hostId;
    if (!targetHostId) return;
    setIsLoadingSessions(true);
    try {
      const res = await fetch(`/api/hosts/${targetHostId}/opencode/sessions`);
      const data = await res.json();
      if (Array.isArray(data.sessions)) {
        setAvailableSessions(data.sessions);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const fetchOpenCodeModels = async (hostIdOverride?: string) => {
    const targetHostId = hostIdOverride || project?.hostId;
    if (!targetHostId) return;
    setIsLoadingModels(true);
    try {
      const res = await fetch(`/api/hosts/${targetHostId}/opencode/models`);
      const data = await res.json();
      if (Array.isArray(data.models) && data.models.length > 0) {
        setAvailableModels(data.models);
        setOpenCodeModel((prev) => {
          if (!prev || !data.models.some((m: any) => m.fullId === prev)) {
            return data.defaultModel || data.models[0].fullId;
          }
          return prev;
        });
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingModels(false);
    }
  };

  const checkHostOpenCode = async () => {
    if (!project?.hostId) return;
    setCheckingOpenCodeHealth(true);
    try {
      const res = await fetch(`/api/hosts/${project.hostId}/opencode/health`);
      const data = await res.json();
      setOpenCodeHealth(data);
      if (data?.healthy) {
        fetchOpenCodeSessions(project.hostId);
        fetchOpenCodeModels(project.hostId);
      }
    } catch (err: any) {
      setOpenCodeHealth({ healthy: false, error: err.message });
    } finally {
      setCheckingOpenCodeHealth(false);
    }
  };

  const handleRunOpenCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openCodePrompt.trim()) return;
    setIsRunningOpenCode(true);
    setOpenCodeError('');

    const promptText = openCodePrompt.trim();
    const titleText = openCodeTitle?.trim() || (promptText.slice(0, 60) + (promptText.length > 60 ? '...' : ''));
    const directoryText = openCodeDirectory.trim() || undefined;
    const sessionText = openCodeSessionId.trim() || undefined;
    const modelText = openCodeModel.trim() || undefined;
    const effortText = openCodeReasoningEffort !== 'none' ? openCodeReasoningEffort : undefined;

    // Очищаем форму сразу, чтобы дать мгновенный отклик
    setOpenCodePrompt('');
    setOpenCodeTitle('');
    setSelectedTaskIdForOpenCode('');

    // Оптимистично добавляем таску в список запусков, чтобы пользователь сразу видел прогресс
    const optRunId = `opt_${Date.now()}`;
    const optimisticRun: any = {
      id: optRunId,
      hostId: project.hostId,
      projectId: project.id,
      title: titleText,
      prompt: promptText,
      status: 'running',
      response: null,
      diff: null,
      errorMessage: null,
      createdAt: Date.now(),
      completedAt: null,
      hostName: allHosts.find((h: any) => h.id === project?.hostId)?.name || 'Сервер',
      projectTitle: project?.title || 'Проект',
    };
    setOpenCodeRuns((prev) => [optimisticRun, ...prev]);
    setExpandedRunId(optRunId);

    try {
      const res = await fetch('/api/opencode/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          prompt: promptText,
          title: titleText,
          directory: directoryText,
          sessionId: sessionText,
          model: modelText,
          reasoningEffort: effortText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка выполнения OpenCode');
      await fetchOpenCodeRuns();
      if (project.hostId) {
        fetchOpenCodeSessions(project.hostId);
      }
      if (data.run?.id) setExpandedRunId(data.run.id);
    } catch (err: any) {
      setOpenCodeError(err.message);
      await fetchOpenCodeRuns();
    } finally {
      setIsRunningOpenCode(false);
    }
  };

  const handleSendTaskToOpenCode = (task: any) => {
    setOpenCodeTitle(`Задача: ${task.title}`);
    setOpenCodePrompt(`Пожалуйста, реши задачу по проекту "${project.title}":\n\nНазвание: ${task.title}\nОписание: ${task.description || 'Не указано'}\nПриоритет: ${task.priority}\nКолонка: ${task.column}`);
    setSelectedTaskIdForOpenCode(task.id);
    setActiveTab('opencode');
    fetchOpenCodeRuns();
    checkHostOpenCode();
    if (project?.hostId) {
      fetchOpenCodeSessions(project.hostId);
      fetchOpenCodeModels(project.hostId);
    }
  };

  const handleDeleteRun = async (runId: string) => {
    if (!confirm('Удалить этот запуск из истории?')) return;
    try {
      await fetch(`/api/opencode/runs/${runId}`, { method: 'DELETE' });
      setOpenCodeRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncRun = async (runId: string, silent: boolean = false) => {
    setSyncingRunId(runId);
    try {
      const res = await fetch(`/api/opencode/runs/${runId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка синхронизации');
      await fetchOpenCodeRuns();
      if (!silent && data.message) {
        alert(data.message);
      }
    } catch (err: any) {
      if (!silent) {
        alert(err.message || 'Ошибка синхронизации');
      }
    } finally {
      setSyncingRunId(null);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    let ok = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {}
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }
    if (ok) {
      setCopiedDiffId(id);
      setTimeout(() => setCopiedDiffId(null), 2000);
    }
  };

  useEffect(() => {
    fetchProject();
    fetchMembers();
    fetchOpenCodeRuns();
    fetchHostsList();
  }, [projectId]);

  useEffect(() => {
    setSelectedHostId(project?.hostId || '');
    if (project?.hostId) {
      fetchOpenCodeSessions(project.hostId);
      fetchOpenCodeModels(project.hostId);
    }
  }, [project?.hostId]);

  // Автоматический опрос (polling) и фоновая синхронизация OpenCode-запусков
  useEffect(() => {
    if (activeTab !== 'opencode') return;

    const hasRunning = openCodeRuns.some((r) => r.status === 'running' || r.status === 'pending');

    // Если есть запущенные таски — опрашиваем каждые 3 секунды, иначе раз в 15 секунд
    const pollIntervalMs = hasRunning || isRunningOpenCode ? 3000 : 15000;
    const pollTimer = setInterval(() => {
      fetchOpenCodeRuns();
    }, pollIntervalMs);

    // Фоновая синхронизация для тасок, ожидающих ответа в фоне (в т.ч. после 524 таймаута)
    let syncTimer: any = null;
    const runningWithSession = openCodeRuns.filter(
      (r) => r.status === 'running' && r.sessionId && !r.id.startsWith('opt_')
    );
    if (runningWithSession.length > 0 && !syncingRunId) {
      syncTimer = setInterval(() => {
        for (const run of runningWithSession) {
          handleSyncRun(run.id, true);
        }
      }, 5000);
    }

    return () => {
      clearInterval(pollTimer);
      if (syncTimer) clearInterval(syncTimer);
    };
  }, [activeTab, openCodeRuns, isRunningOpenCode, syncingRunId, projectId]);

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToShare) {
      setShareError('Выберите пользователя');
      return;
    }
    setIsSharing(true);
    setShareError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserToShare,
          role: shareRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка предоставления доступа');
      setIsShareModalOpen(false);
      setSelectedUserToShare('');
      fetchMembers();
      fetchProject();
    } catch (err: any) {
      setShareError(err.message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRevokeAccess = async (userId: string, username: string) => {
    if (!confirm(`Отозвать доступ к проекту для пользователя @${username}?`)) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/members?userId=${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchMembers();
        fetchProject();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveTask = async (taskId: string, newColumn: string) => {
    try {
      await fetch(`/api/kanban/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column: newColumn }),
      });
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Удалить эту задачу?')) return;
    try {
      await fetch(`/api/kanban/tasks/${taskId}`, { method: 'DELETE' });
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (!confirm('Удалить эту связь между проектами?')) return;
    try {
      await fetch(`/api/relations?id=${relationId}`, { method: 'DELETE' });
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDeploy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployment: {
            runtimeType: deployRuntime,
            deployAutomation,
            containers: deployContainers,
            internalPort: deployContainers[0]?.port
              ? Number(deployContainers[0].port)
              : deployPort
              ? Number(deployPort)
              : null,
            containerName:
              deployContainers[0]?.containerName ||
              deployContainers[0]?.name ||
              deployContainer ||
              null,
            deployPath: deployPath || null,
            deployCommand: deployCommand || null,
            envKeysHint: deployEnvHint || null,
            secretsType,
            secretsPathOrUri: secretsPathOrUri || null,
            notes: deployNotes || null,
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Не удалось сохранить параметры деплоя');
      }
      fetchProject();
      alert('Параметры деплоя и обвеса успешно сохранены!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Ошибка сохранения параметров деплоя');
    } finally {
      setIsSavingDeploy(false);
    }
  };

  const handleSaveWiki = async () => {
    setIsSavingWiki(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readmeNotes: wikiNotes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Не удалось сохранить заметки');
      }
      fetchProject();
      alert('Заметки сохранены!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Ошибка сохранения заметок');
    } finally {
      setIsSavingWiki(false);
    }
  };

  const handleCheckHealth = async (targetId: string) => {
    try {
      await fetch('/api/metrics/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      });
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMetricTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTargetName,
          target: newTargetUrl,
          checkType: newTargetType,
          projectId: project.id,
          hostId: project.hostId || null,
        }),
      });
      setNewTargetName('');
      setNewTargetUrl('');
      setIsAddingTarget(false);
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm(`Вы действительно хотите удалить проект "${project.title}"? Это действие необратимо.`)) return;
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      router.push('/projects');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-cyan-400 font-mono text-sm animate-pulse">Загрузка данных проекта...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold text-white">Проект не найден</h2>
        <Link href="/projects" className="text-cyan-400 hover:underline text-sm font-mono">
          Вернуться в реестр
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_COLORS[project.status] || STATUS_COLORS.idea;
  const kanbanColumns = [
    { id: 'backlog', label: 'Бэклог', color: 'border-slate-700' },
    { id: 'todo', label: 'To Do', color: 'border-amber-500/40' },
    { id: 'in_progress', label: 'В работе', color: 'border-cyan-500/40' },
    { id: 'review', label: 'Ревью / Тест', color: 'border-indigo-500/40' },
    { id: 'done', label: 'Выполнено', color: 'border-emerald-500/40' },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Back button & Action bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Назад в реестр
        </Link>

        <button
          onClick={handleDeleteProject}
          className="text-xs text-rose-400/80 hover:text-rose-400 font-mono flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Удалить проект
        </button>
      </div>

      {/* Project Master Header */}
      <div className="p-6 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-400">
                {project.category}
              </span>
              <span className="text-xs font-mono text-slate-400">{project.slug}</span>
              {project.host && (
                <span className="text-xs font-mono text-indigo-300 flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40">
                  <Server className="w-3 h-3" /> {project.host.name}
                </span>
              )}
              {ownerInfo && (
                <span className="text-xs font-mono text-amber-300 flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40">
                  <Crown className="w-3 h-3 text-amber-400" /> @{ownerInfo.username}
                </span>
              )}
              {project.userRole && project.userRole !== 'owner' && (
                <span className="text-xs font-mono text-emerald-300 flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> {project.userRole === 'admin' ? 'Админ' : project.userRole === 'editor' ? 'Редактор' : 'Просмотр'}
                </span>
              )}
              {project.deployment?.secretsType && (
                <span
                  className={`text-xs font-mono flex items-center gap-1.5 px-2 py-0.5 rounded border ${
                    SECRETS_TYPE_LABELS[project.deployment.secretsType]?.badge || 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                  title={SECRETS_TYPE_LABELS[project.deployment.secretsType]?.description || ''}
                >
                  {project.deployment.secretsType === 'hardcode' ? (
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                  ) : (
                    <Lock className="w-3 h-3" />
                  )}
                  <span>{SECRETS_TYPE_LABELS[project.deployment.secretsType]?.label || project.deployment.secretsType}</span>
                  {project.deployment.secretsPathOrUri && (
                    <span className="opacity-75">({project.deployment.secretsPathOrUri})</span>
                  )}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{project.title}</h1>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">{project.description}</p>
          </div>

          {/* Interactive Status Switcher */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {project.canEdit && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono transition-colors"
                title="Изменить название, описание, сайт и другие поля"
              >
                <Edit3 className="w-3.5 h-3.5" /> Редактировать
              </button>
            )}
            <label className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Статус жизненного цикла</label>
            <select
              value={project.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-semibold border focus:outline-none cursor-pointer ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
            >
              <option value="idea">💡 Идея</option>
              <option value="backlog">📋 В бэклоге</option>
              <option value="in_dev">🟡 В разработке</option>
              <option value="staging">🔵 Staging</option>
              <option value="production">🟢 Production</option>
              <option value="paused">🟠 Приостановлен</option>
              <option value="archived">⚪ В архиве</option>
            </select>
          </div>
        </div>

        {/* Quick External Links & Tech Tags */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {project.tags?.map((t: string) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 border border-slate-800 text-slate-400"
              >
                #{t}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs">
            {project.publicUrl && (
              <a
                href={project.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 transition-colors font-mono"
              >
                <Globe className="w-3.5 h-3.5" /> Открыть сайт
              </a>
            )}
            {project.repoUrl && (
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors font-mono"
              >
                <GitBranch className="w-3.5 h-3.5" /> Репозиторий
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('kanban')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'kanban'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Kanban className="w-4 h-4" /> Канбан задачи ({project.tasks?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'overview'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" /> Деплой & Инфраструктура
        </button>

        <button
          onClick={() => setActiveTab('relations')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'relations'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Network className="w-4 h-4" /> Связи с проектами (
          {(project.relations?.outgoing?.length || 0) + (project.relations?.incoming?.length || 0)})
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'telemetry'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" /> Мониторинг & Health ({project.metricTargets?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('wiki')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'wiki'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" /> Архитектурные заметки
        </button>

        <button
          onClick={() => {
            setActiveTab('members');
            fetchMembers();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'members'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" /> Участники & Доступ ({members.length + (ownerInfo ? 1 : 0)})
        </button>

        <button
          onClick={() => {
            setActiveTab('opencode');
            fetchOpenCodeRuns();
            checkHostOpenCode();
            if (project?.hostId) {
              fetchOpenCodeSessions(project.hostId);
              fetchOpenCodeModels(project.hostId);
            }
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'opencode'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4 text-cyan-400" /> OpenCode AI ({openCodeRuns.length})
        </button>
      </div>

      {/* TAB 1: KANBAN BOARD */}
      {activeTab === 'kanban' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">
              Перемещайте задачи между этапами. AI-агенты через MCP могут автоматически обновлять эти колонки.
            </span>
            <div className="flex items-center gap-2">
              {headerActionSlot}
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Добавить задачу
              </button>
            </div>
          </div>

{bannerSlot}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto min-w-[900px] pb-4">
            {kanbanColumns.map((col) => {
              const colTasks = project.tasks?.filter((t: any) => t.column === col.id) || [];
              return (
                <div key={col.id} className="p-3.5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <span className="text-xs font-bold font-mono uppercase text-slate-300 flex items-center gap-2">
                      {col.label}
                    </span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 min-h-[300px]">
                    {colTasks.map((t: any) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all space-y-2 group shadow"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors leading-snug">
                            {t.title}
                          </h4>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleSendTaskToOpenCode(t)}
                              className="p-1 rounded text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors"
                              title="Отправить задачу в OpenCode"
                            >
                              <Zap className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(t.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {t.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-2">{t.description}</p>
                        )}

                        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              t.priority === 'urgent'
                                ? 'bg-rose-500/20 text-rose-400'
                                : t.priority === 'high'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {t.priority}
                          </span>

                          {/* Quick Column Shift Dropdown */}
                          <select
                            value={t.column}
                            onChange={(e) => handleMoveTask(t.id, e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] text-slate-300 focus:outline-none"
                          >
                            <option value="backlog">Бэклог</option>
                            <option value="todo">To Do</option>
                            <option value="in_progress">В работе</option>
                            <option value="review">Тест</option>
                            <option value="done">Готово</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: OVERVIEW & DEPLOYMENT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Host assignment / migration */}
          <div className="p-6 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Server className="w-5 h-5 text-cyan-400" /> Сервер размещения и миграция
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {project?.hostId
                    ? `Сейчас: ${project?.host?.name || project.hostId}. Выберите новый сервер для миграции.`
                    : 'Сервер не назначен. Выберите сервер, чтобы включить OpenCode и health-чеки.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleMigrateHost}
                disabled={isMigrating || selectedHostId === (project?.hostId || '')}
                className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-xs transition-colors disabled:opacity-50"
              >
                {isMigrating ? 'Миграция...' : project?.hostId ? 'Мигрировать' : 'Назначить сервер'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">Сервер</label>
                <select
                  value={selectedHostId}
                  onChange={(e) => setSelectedHostId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                >
                  <option value="">Не привязан (локально / облако)</option>
                  {allHosts.map((h: any) => (
                    <option key={h.id} value={h.id}>
                      {h.name}{h.ipAddress ? ` — ${h.ipAddress}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-[11px] text-slate-500 font-mono self-end">
                После миграции проверьте: путь к проекту, порты, секреты, health-таргеты, OpenCode на новом хосте.
              </div>
            </div>
          </div>

        <form onSubmit={handleSaveDeployment} className="p-6 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-indigo-400" /> Профиль деплоя и запуска
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Параметры окружения, директория на сервере, порт и скрипты автоматического перезапуска.
              </p>
            </div>
            <button
              type="submit"
              disabled={isSavingDeploy}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {isSavingDeploy ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">Среда / Оркестратор (Runtime)</label>
              <select
                value={deployRuntime}
                onChange={(e) => setDeployRuntime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
              >
                <option value="docker_compose">Docker Compose</option>
                <option value="docker_standalone">Docker Standalone Container</option>
                <option value="kubernetes">☸️ Kubernetes (K8s Pod / Deployment)</option>
                <option value="docker_swarm">🐳 Docker Swarm Service</option>
                <option value="coolify_portainer">📦 Coolify / Portainer Stack</option>
                <option value="systemd_service">⚙️ Systemd Service</option>
                <option value="pm2">🚀 PM2 Daemon</option>
                <option value="cron">⏰ Cron Schedule</option>
                <option value="nomad">HashiCorp Nomad</option>
                <option value="serverless">⚡ Serverless / Cloudflare Worker</option>
                <option value="manual">Manual Exec</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">CI/CD & Автоматизация деплоя</label>
              <select
                value={deployAutomation}
                onChange={(e) => setDeployAutomation(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
              >
                <option value="github_actions">GitHub Actions (CI/CD)</option>
                <option value="jenkins">👨‍✈️ Jenkins Pipeline</option>
                <option value="gitlab_ci">🦊 GitLab CI/CD</option>
                <option value="argocd">🐙 ArgoCD GitOps</option>
                <option value="webhook">🪝 Webhook Trigger</option>
                <option value="manual_ssh">🔑 Ручной SSH вход</option>
                <option value="local_script">📜 Локальный bash-скрипт</option>
              </select>
            </div>
          </div>

          {/* Containers: compact cards grid */}
          <div className="pt-2">
            <ContainerCards
              containers={deployContainers}
              onAdd={addDeployContainer}
              onUpdate={updateDeployContainer}
              onRemove={removeDeployContainer}
              title="Контейнеры и открытые порты"
              description="Управляйте микросервисами, базами данных, очередями и открытыми портами проекта с выбором сетевого протокола."
              addLabel="Добавить контейнер / сервис"
              minCount={0}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">Путь к проекту на сервере</label>
              <input
                type="text"
                value={deployPath}
                onChange={(e) => setDeployPath(e.target.value)}
                placeholder="/opt/services/my-project"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1 font-mono">Используется как рабочая директория OpenCode (directory) при запусках и автопилоте.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">Команда обновления / манифест деплоя</label>
              <input
                type="text"
                value={deployCommand}
                onChange={(e) => setDeployCommand(e.target.value)}
                placeholder="kubectl apply -f k8s/ или docker compose pull && docker compose up -d"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono"
              />
            </div>
          </div>

          {/* Section: Infrastructure Addons — collapsible spoilers, collapsed when empty */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <h4 className="text-xs uppercase font-mono tracking-wider text-emerald-400 font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4" /> Полезный обвес: Бэкапы, S3/R2 Хранилище, FTP & Sentry
            </h4>

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
                    placeholder="0 3 * * *"
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
                  <label className="block text-[11px] text-slate-400 mb-1 font-mono">Куда отправлять (Destination)</label>
                  <input
                    type="text"
                    value={backupDestination}
                    onChange={(e) => setBackupDestination(e.target.value)}
                    placeholder="Cloudflare R2 Bucket 'db-backups', S3"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  />
                </div>
              </div>
            </AddonSpoiler>

            {/* S3 / Cloudflare R2 Storage */}
            <AddonSpoiler
              icon="🗄️"
              title="Объектное хранилище (S3 / Cloudflare R2)"
              hint="Провайдер, бакет и endpoint"
              hasData={Boolean(storageBucket.trim() || storageEndpoint.trim())}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-mono">Провайдер</label>
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
                  <label className="block text-[11px] text-slate-400 mb-1 font-mono">Имя бакета (Bucket)</label>
                  <input
                    type="text"
                    value={storageBucket}
                    onChange={(e) => setStorageBucket(e.target.value)}
                    placeholder="my-project-assets"
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
                  <label className="block text-[11px] text-slate-400 mb-1 font-mono">Хост / IP</label>
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
                  placeholder="sentry-crm-prod или DSN hint"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>
            </AddonSpoiler>
          </div>

          {/* Section: Secrets & Environment Management */}
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <h4 className="text-xs uppercase font-mono tracking-wider text-amber-400 font-semibold flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Управление секретами & Переменными окружения
            </h4>

            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5 font-mono">
                    Способ хранения секретов (Secrets Storage)
                  </label>
                  <select
                    value={secretsType}
                    onChange={(e) => setSecretsType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                  >
                    <option value="dotenv">📄 Файл .env / System Env</option>
                    <option value="vault">🔐 HashiCorp Vault</option>
                    <option value="k8s_secrets">☸️ Kubernetes Secrets</option>
                    <option value="docker_secrets">🐳 Docker Secrets (/run/secrets)</option>
                    <option value="doppler_infisical">🔑 Doppler / Infisical</option>
                    <option value="aws_secrets">☁️ Cloud Secrets (AWS / GCP / Cloud)</option>
                    <option value="cicd_secrets">🐙 CI/CD Secrets (GitHub / GitLab)</option>
                    <option value="hardcode">⚠️ В коде / Хардкод (небезопасно)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {SECRETS_TYPE_LABELS[secretsType]?.description || ''}
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5 font-mono">
                    Путь к секретам / Vault Mount / Имя Secret
                  </label>
                  <input
                    type="text"
                    value={secretsPathOrUri}
                    onChange={(e) => setSecretsPathOrUri(e.target.value)}
                    placeholder={SECRETS_TYPE_LABELS[secretsType]?.placeholder || 'Путь или имя секрета'}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono placeholder-slate-600"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    {secretsType === 'vault' && 'Пример: secret/data/prod/my-service'}
                    {secretsType === 'k8s_secrets' && 'Пример: my-app-secrets (Namespace: default)'}
                    {secretsType === 'docker_secrets' && 'Пример: /run/secrets/api_token'}
                    {secretsType === 'dotenv' && 'Пример: /opt/services/app/.env.production'}
                    {secretsType === 'doppler_infisical' && 'Пример: Project: app / Config: prd'}
                    {secretsType === 'aws_secrets' && 'Пример: arn:aws:secretsmanager:...'}
                    {secretsType === 'cicd_secrets' && 'Пример: Repository Secrets (GITHUB_TOKEN)'}
                    {secretsType === 'hardcode' && 'Файл с конфигом (Рекомендуется мигрировать!)'}
                  </p>
                </div>
              </div>

              {secretsType === 'hardcode' && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Внимание:</strong> Секреты захардкожены в исходном коде или репозитории. Это критическая уязвимость. Перенесите переменные в .env файл, Vault или Kubernetes Secrets!
                  </span>
                </div>
              )}

              <div>
                <label className="block text-[11px] text-slate-400 mb-1.5 font-mono">
                  Список необходимых .env переменных (без значений и паролей!)
                </label>
                <input
                  type="text"
                  value={deployEnvHint}
                  onChange={(e) => setDeployEnvHint(e.target.value)}
                  placeholder="BOT_TOKEN, DATABASE_URL, REDIS_PORT, SECRET_KEY"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono placeholder-slate-600"
                />
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  Только имена переменных для памятки разработчику и чек-листа деплоя (пароли и токены в Visor не вводятся).
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">Памятка по настройке и портам</label>
            <textarea
              rows={3}
              value={deployNotes}
              onChange={(e) => setDeployNotes(e.target.value)}
              placeholder="Nginx конфигурация, особенности запуска..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
            />
          </div>
        </form>
        </div>
      )}

      {/* TAB 3: RELATIONS */}
      {activeTab === 'relations' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-cyan-400" /> Связи этого проекта в экосистеме
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Визуализирует, от каких сервисов зависит проект и кто обращается к нему.
              </p>
            </div>

            <button
              onClick={() => setIsRelationModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Добавить связь
            </button>
          </div>

          {/* Outgoing */}
          <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
              Исходящие связи (Этот проект ➔ Другие сервисы)
            </h4>

            {project.relations?.outgoing?.length === 0 ? (
              <div className="text-xs text-slate-500 font-mono py-2">Нет исходящих связей</div>
            ) : (
              <div className="space-y-2">
                {project.relations?.outgoing?.map((r: any) => {
                  const meta = RELATION_LABELS[r.relationType] || { label: r.relationType, color: '#94a3b8' };
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                          style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <Link
                          href={`/projects/${r.targetProjectId}`}
                          className="font-bold text-white hover:text-cyan-300 text-xs"
                        >
                          {r.targetProjectTitle}
                        </Link>
                        {r.description && <span className="text-xs text-slate-400">— {r.description}</span>}
                      </div>

                      <button
                        onClick={() => handleDeleteRelation(r.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Удалить связь"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Incoming */}
          <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold">
              Входящие связи (Другие сервисы ➔ Этот проект)
            </h4>

            {project.relations?.incoming?.length === 0 ? (
              <div className="text-xs text-slate-500 font-mono py-2">Нет входящих связей</div>
            ) : (
              <div className="space-y-2">
                {project.relations?.incoming?.map((r: any) => {
                  const meta = RELATION_LABELS[r.relationType] || { label: r.relationType, color: '#94a3b8' };
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/projects/${r.sourceProjectId}`}
                          className="font-bold text-white hover:text-cyan-300 text-xs"
                        >
                          {r.sourceProjectTitle}
                        </Link>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                          style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        {r.description && <span className="text-xs text-slate-400">— {r.description}</span>}
                      </div>

                      <button
                        onClick={() => handleDeleteRelation(r.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Удалить связь"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TELEMETRY & HEALTH */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" /> Живой статус и Healthcheck
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Опрос контрольных точек (HTTP ping или Prometheus PromQL) и замер задержки ответа.
              </p>
            </div>

            <button
              onClick={() => setIsAddingTarget(!isAddingTarget)}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Добавить эндпоинт
            </button>
          </div>

          {isAddingTarget && (
            <form onSubmit={handleAddMetricTarget} className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-3">
              <h4 className="text-xs font-bold text-white font-mono">Новая контрольная точка</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Имя (напр. API Healthcheck)"
                  value={newTargetName}
                  onChange={(e) => setNewTargetName(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
                <input
                  type="text"
                  required
                  placeholder="URL или PromQL запрос"
                  value={newTargetUrl}
                  onChange={(e) => setNewTargetUrl(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
                <select
                  value={newTargetType}
                  onChange={(e) => setNewTargetType(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                >
                  <option value="http_ping">HTTP Ping (GET)</option>
                  <option value="prometheus_query">Prometheus Query</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingTarget(false)}
                  className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                >
                  Отмена
                </button>
                <button type="submit" className="px-4 py-1 rounded bg-cyan-500 text-slate-950 text-xs font-semibold">
                  Добавить
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {project.metricTargets?.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#0f172a] border border-dashed border-slate-800 text-center">
                <p className="text-xs text-slate-400">Для этого проекта еще не настроены контрольные точки мониторинга.</p>
              </div>
            ) : (
              project.metricTargets?.map((t: any) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl bg-[#0f172a] border border-slate-800 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          t.lastStatus === 'healthy'
                            ? 'bg-emerald-400'
                            : t.lastStatus === 'warning'
                            ? 'bg-amber-400'
                            : t.lastStatus === 'critical'
                            ? 'bg-rose-500'
                            : 'bg-slate-500'
                        }`}
                      />
                      <h4 className="text-xs font-bold text-white font-mono">{t.name}</h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {t.checkType}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">{t.target}</div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right font-mono">
                      <div className="text-xs text-white font-semibold">{t.lastValue || '—'}</div>
                      <div className="text-[10px] text-slate-400">
                        {t.lastResponseTimeMs ? `${t.lastResponseTimeMs} ms` : '—'}
                      </div>
                    </div>

                    <button
                      onClick={() => handleCheckHealth(t.id)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 transition-colors"
                      title="Опросить сейчас"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ARCHITECTURE WIKI / NOTES */}
      {activeTab === 'wiki' && (
        <div className="p-6 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" /> Архитектурные заметки (Wiki)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Быстрая памятка по решениям, структуре каталогов, логинам тестовых стендов.
              </p>
            </div>
            <button
              onClick={handleSaveWiki}
              disabled={isSavingWiki}
              className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" /> {isSavingWiki ? 'Сохранение...' : 'Сохранить заметки'}
            </button>
          </div>

          <textarea
            rows={15}
            value={wikiNotes}
            onChange={(e) => setWikiNotes(e.target.value)}
            placeholder="Пишите здесь в формате Markdown: идеи, список фичей, адреса баз данных, особенности развертывания..."
            className="w-full p-4 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-100 font-mono text-xs leading-relaxed focus:outline-none focus:border-cyan-500"
          />
        </div>
      )}

      {/* TAB 6: MEMBERS & ACCESS */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" /> Участники & Управление доступом
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Предоставляйте доступ другим пользователям к вашему проекту с разделением ролей (Редактор / Просмотр).
                </p>
              </div>

              {canManageMembers && (
                <button
                  onClick={() => {
                    fetchAllUsers();
                    setIsShareModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-2 transition-colors shadow-lg shadow-cyan-500/20"
                >
                  <UserPlus className="w-4 h-4" /> Предоставить доступ
                </button>
              )}
            </div>

            {/* Owner Card */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">@{ownerInfo?.username || 'admin'}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold">
                      Владелец проекта
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Создатель проекта (полный контроль, удаление проекта, управление доступом).
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 font-mono hidden md:block">
                Владелец
              </div>
            </div>

            {/* Collaborators List */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Приглашенные пользователи ({members.length})
              </h4>

              {members.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-600 mx-auto" />
                  <div className="text-xs text-slate-400">
                    К этому проекту еще не подключены другие пользователи.
                  </div>
                  {canManageMembers && (
                    <button
                      onClick={() => {
                        fetchAllUsers();
                        setIsShareModalOpen(true);
                      }}
                      className="text-xs text-cyan-400 hover:underline font-mono"
                    >
                      Предоставить доступ коллеге ➔
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                  {members.map((m) => (
                    <div key={m.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-cyan-400 text-sm">
                          {m.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">@{m.username}</span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                                m.role === 'editor'
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                            >
                              {m.role === 'editor' ? 'Редактор' : 'Только чтение'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 font-mono text-[11px]">
                            {m.role === 'editor'
                              ? 'Может создавать и перемещать задачи, редактировать деплой'
                              : 'Может просматривать карточку проекта, метрики и задачи'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-[11px] font-mono text-slate-500 hidden md:inline">
                          Добавлен: {formatDateTime(m.createdAt)}
                        </span>
                        {canManageMembers && (
                          <button
                            onClick={() => handleRevokeAccess(m.userId, m.username)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Отозвать доступ"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Share Access Modal */}
          {isShareModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
              <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-base font-bold text-white">Предоставить доступ к проекту</h3>
                  </div>
                  <button
                    onClick={() => setIsShareModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    ✕
                  </button>
                </div>

                {shareError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                    {shareError}
                  </div>
                )}

                <form onSubmit={handleGrantAccess} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                      Выберите пользователя
                    </label>
                    <select
                      value={selectedUserToShare}
                      onChange={(e) => setSelectedUserToShare(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                      required
                    >
                      <option value="">-- Выберите из списка пользователей --</option>
                      {allUsersList
                        .filter((u) => u.id !== ownerInfo?.id && !members.some((m) => m.userId === u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            @{u.username} ({u.role})
                          </option>
                        ))}
                    </select>
                    {allUsersList.length <= 1 && (
                      <p className="text-[11px] text-slate-500 mt-1 font-mono">
                        Подсказка: Вы можете зарегистрировать новых пользователей в разделе «Настройки токенов» или через API /api/users.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                      Уровень прав доступа
                    </label>
                    <select
                      value={shareRole}
                      onChange={(e) => setShareRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                    >
                      <option value="editor">Редактор (создание задач, правка деплоя, заметки)</option>
                      <option value="viewer">Только чтение (просмотр карточки, задач и метрик)</option>
                    </select>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsShareModalOpen(false)}
                      className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 text-xs transition-colors"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={isSharing}
                      className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50"
                    >
                      {isSharing ? 'Предоставление...' : 'Открыть доступ'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: OPENCODE AI */}
      {activeTab === 'opencode' && (
        <div className="space-y-6">
          <OpenCodeChat
            projectId={project.id}
            project={project}
            onOpenKanban={() => setActiveTab('kanban')}
          />
        </div>
      )}

      {/* Modals */}
      <CreateTaskModal
        isOpen={isTaskModalOpen}
        defaultProjectId={project.id}
        onClose={() => setIsTaskModalOpen(false)}
        onCreated={fetchProject}
      />
      <CreateRelationModal
        isOpen={isRelationModalOpen}
        defaultSourceId={project.id}
        onClose={() => setIsRelationModalOpen(false)}
        onCreated={fetchProject}
      />
      <EditProjectModal
        project={project}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={fetchProject}
      />
    </div>
  );
}
