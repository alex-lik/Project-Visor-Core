'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Plus,
  RefreshCw,
  AlertTriangle,
  Check,
  Copy,
  FileCode,
  GitBranch,
  ChevronDown,
  Search,
  Clock,
  Zap,
  Server,
  Kanban,
  MessageSquare,
  X,
  ExternalLink,
  Pencil,
  Trash2,
  Terminal,
  FolderOpen,
  Brain,
  StopCircle,
  Layers,
  ArrowRight,
  Share2,
  GitFork,
  ListTodo,
  FolderTree,
  RotateCcw,
  FileText,
  CheckCircle2,
  Circle,
} from 'lucide-react';

export interface OpenCodeChatPart {
  id?: string;
  type: 'text' | 'reasoning' | 'tool' | 'step-start' | 'step-finish' | string;
  text?: string;
  tool?: string;
  callID?: string;
  state?: {
    status?: 'pending' | 'running' | 'completed' | 'error' | string;
    input?: any;
    output?: string;
    title?: string;
    error?: string;
    metadata?: any;
  };
  time?: {
    start?: number;
    end?: number;
  };
}

export interface OpenCodeChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  createdAt?: number;
  completedAt?: number;
  model?: string;
  provider?: string;
  variant?: string;
  finish?: string;
  isGenerating?: boolean;
  parts?: OpenCodeChatPart[];
  thinking?: string;
  tokens?: {
    total?: number;
    input?: number;
    output?: number;
    reasoning?: number;
  };
}

export interface OpenCodeSessionSummary {
  id: string;
  title: string;
  directory?: string;
  createdAt?: number;
  updatedAt?: number;
  status?: string;
  model?: {
    id?: string;
    providerID?: string;
    variant?: string;
  };
  lastRunId?: string;
  lastPrompt?: string;
  lastError?: string;
}

export interface OpenCodeModelOption {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
  fullId: string;
  isDefault?: boolean;
  reasoning?: boolean;
  variants?: string[];
  defaultVariant?: string;
}

export interface OpenCodeAgentOption {
  name: string;
  description?: string;
  mode?: string;
}

export interface OpenCodeTodoItem {
  content: string;
  status: 'completed' | 'in_progress' | 'pending' | string;
  priority?: string;
}

export function formatVariantLabel(variant: string): string {
  const map: Record<string, string> = {
    minimal: 'Minimal (минимальный)',
    low: 'Low (низкий)',
    medium: 'Medium (средний)',
    high: 'High (высокий)',
    xhigh: 'X-High (экстра)',
    max: 'Max (максимальный)',
    none: 'None (отключен)',
    default: 'Default (стандартный)',
  };
  return map[variant.toLowerCase()] || (variant.charAt(0).toUpperCase() + variant.slice(1));
}

export interface OpenCodeChatProps {
  projectId: string;
  project?: any;
  initialSessionId?: string;
  initialTaskId?: string;
  initialTaskTitle?: string;
  onOpenKanban?: () => void;
  className?: string;
}

/**
 * Renders live tool execution steps (bash, read, write, edit) and reasoning stream
 */
function MessageExecutionSteps({
  parts,
  thinking,
  tokens,
  isGenerating,
  onCopy,
  copiedId,
}: {
  parts?: OpenCodeChatPart[];
  thinking?: string;
  tokens?: any;
  isGenerating?: boolean;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}) {
  if (!parts && !thinking) return null;

  const toolParts = (parts || []).filter((p) => p.type === 'tool' || p.tool);

  return (
    <div className="space-y-2 mb-3">
      {/* 1. Reasoning (Thinking Process) Accordion */}
      {thinking && (
        <details className="rounded-xl border border-indigo-500/20 bg-indigo-950/30 overflow-hidden text-xs">
          <summary className="cursor-pointer select-none px-3 py-2 font-medium text-indigo-300 flex items-center justify-between hover:bg-indigo-900/40 transition-colors">
            <span className="flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
              <span>Процесс рассуждений (Reasoning)</span>
              {tokens?.reasoning ? (
                <span className="text-[10px] text-indigo-400/80 font-mono">
                  ({tokens.reasoning} токенов)
                </span>
              ) : null}
            </span>
            <span className="text-[10px] text-indigo-400">раскрыть / скрыть</span>
          </summary>
          <div className="p-3 border-t border-indigo-500/20 text-indigo-200/90 whitespace-pre-wrap font-sans text-xs leading-relaxed max-h-60 overflow-y-auto">
            {thinking}
          </div>
        </details>
      )}

      {/* 2. Tools Execution Steps */}
      {toolParts.map((p, idx) => {
        const tool = (p.tool || 'tool').toLowerCase();
        const state = p.state || {};
        const status = state.status || (isGenerating ? 'running' : 'completed');
        const isRunning = status === 'running' || status === 'pending';
        const isError = status === 'error';
        const partId = p.id || `tool_${idx}`;

        // Tool: Bash
        if (tool === 'bash') {
          const command = state.input?.command || state.title || '';
          const output = state.output || '';
          return (
            <div
              key={partId}
              className="rounded-xl border border-slate-700/80 bg-slate-950 overflow-hidden font-mono text-xs shadow-inner"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px]">
                <div className="flex items-center gap-2 truncate text-slate-300">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-cyan-400 font-bold">bash:</span>
                  <span className="truncate text-slate-200 font-medium">{command}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {output && (
                    <button
                      type="button"
                      onClick={() => onCopy(output, `cmd_${partId}`)}
                      className="text-slate-400 hover:text-cyan-400 p-0.5"
                      title="Скопировать вывод команды"
                    >
                      {copiedId === `cmd_${partId}` ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                  {isRunning ? (
                    <span className="inline-flex items-center gap-1 text-cyan-400 text-[10px] animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Выполняется...
                    </span>
                  ) : isError ? (
                    <span className="inline-flex items-center gap-1 text-rose-400 text-[10px]">
                      <AlertTriangle className="w-3 h-3" /> Ошибка
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px]">
                      <Check className="w-3 h-3" /> Выполнено
                    </span>
                  )}
                </div>
              </div>
              {output && (
                <details className="group" open={isRunning ? true : undefined}>
                  <summary className="px-3 py-1 text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer select-none bg-slate-900/40 flex items-center justify-between border-t border-slate-800/40">
                    <span>Вывод консоли ({output.split('\n').length} строк)</span>
                    <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <pre className="p-3 text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap max-h-56 overflow-y-auto bg-black/70 border-t border-slate-800 font-mono select-text">
                    {output}
                  </pre>
                </details>
              )}
            </div>
          );
        }

        // Tool: File Read
        if (tool === 'read') {
          const filePath = state.input?.filePath || state.title || '';
          return (
            <div
              key={partId}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950/70 text-xs font-mono flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-2 truncate">
                <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-slate-400">Чтение:</span>
                <span className="text-slate-200 truncate">{filePath}</span>
              </div>
              {isRunning ? (
                <span className="inline-flex items-center gap-1 text-cyan-400 text-[10px]">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                </span>
              ) : (
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
              )}
            </div>
          );
        }

        // Tool: File Write / Edit
        if (tool === 'write' || tool === 'edit') {
          const filePath = state.input?.filePath || state.title || '';
          return (
            <div
              key={partId}
              className="px-3 py-1.5 rounded-xl border border-emerald-900/40 bg-emerald-950/20 text-xs font-mono flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-2 truncate">
                <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-emerald-400 font-semibold">{tool === 'edit' ? 'Правка:' : 'Запись:'}</span>
                <span className="text-slate-200 truncate">{filePath}</span>
              </div>
              {isRunning ? (
                <RefreshCw className="w-3 h-3 animate-spin text-cyan-400 shrink-0" />
              ) : (
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
              )}
            </div>
          );
        }

        // Generic tool fallback (webfetch, todowrite, question, etc.)
        return (
          <div
            key={partId}
            className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/50 text-xs font-mono flex items-center justify-between"
          >
            <div className="flex items-center gap-2 truncate">
              <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-slate-400">Инструмент {tool}:</span>
              <span className="text-slate-200 truncate">{state.title || JSON.stringify(state.input || {})}</span>
            </div>
            {isRunning && <RefreshCw className="w-3 h-3 animate-spin text-cyan-400 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

export default function OpenCodeChat({
  projectId,
  project,
  initialSessionId,
  initialTaskId,
  initialTaskTitle,
  onOpenKanban,
  className = '',
}: OpenCodeChatProps) {
  // Session state
  const [sessions, setSessions] = useState<OpenCodeSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId || null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Session rename & delete state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isSavingSessionTitle, setIsSavingSessionTitle] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<OpenCodeSessionSummary | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Chat conversation state
  const [messages, setMessages] = useState<OpenCodeChatMessage[]>([]);
  const [diff, setDiff] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [cloudflare524Notice, setCloudflare524Notice] = useState<string | null>(null);

  // Input & Models state
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<OpenCodeModelOption[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // OpenCode Agents (build, plan, explore)
  const [availableAgents, setAvailableAgents] = useState<OpenCodeAgentOption[]>([
    { name: 'build', description: 'Полный режим разработки (код, терминал, файлы)', mode: 'primary' },
    { name: 'plan', description: 'Только чтение и планирование без изменений', mode: 'primary' },
    { name: 'explore', description: 'Быстрое исследование файлов и кодовой базы', mode: 'primary' },
  ]);
  const [selectedAgent, setSelectedAgent] = useState<string>('build');

  // VCS Info (Git branch)
  const [vcsInfo, setVcsInfo] = useState<{ branch?: string; default_branch?: string } | null>(null);

  // Session Todos Checklist
  const [todos, setTodos] = useState<OpenCodeTodoItem[]>([]);
  const [isTodosOpen, setIsTodosOpen] = useState(false);

  // Share session modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  // Fork session state
  const [isForking, setIsForking] = useState(false);

  // Reverting state
  const [revertingMsgId, setRevertingMsgId] = useState<string | null>(null);

  // Code Search & File Browser Drawer
  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [explorerTab, setExplorerTab] = useState<'files' | 'search'>('files');
  const [currentPath, setCurrentPath] = useState('');
  const [filesList, setFilesList] = useState<Array<{ name: string; path?: string; type: 'file' | 'directory'; size?: number }>>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFileContent, setSelectedFileContent] = useState<{ path: string; content: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'file' | 'content'>('file');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Kanban tasks state
  const [kanbanTasks, setKanbanTasks] = useState<any[]>(project?.tasks || []);
  const [selectedTaskId, setSelectedTaskId] = useState(initialTaskId || '');

  // Host info & OpenCode status
  const [hostInfo, setHostInfo] = useState<any>(null);
  const [deployDirectory, setDeployDirectory] = useState<string>(
    project?.deployment?.deployPath || ''
  );
  const [generalError, setGeneralError] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  // LocalStorage keys for persistence
  const storageKeyModel = `visor_opencode_model_${projectId}`;
  const storageKeyVariant = `visor_opencode_variant_${projectId}`;
  const storageKeyAgent = `visor_opencode_agent_${projectId}`;

  // Scroll messages container directly (never scrolls the page window!)
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      setIsScrolledUp(false);
    }
  };

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsScrolledUp(distanceFromBottom > 150);
  };

  // Copy helper
  const handleCopy = async (text: string, id: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        return;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  // 1. Fetch available models for the host & restore user preferences from localStorage
  const fetchModels = async (hostId: string) => {
    try {
      const res = await fetch(`/api/hosts/${hostId}/opencode/models`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModels(data.models);

          const savedModel =
            typeof window !== 'undefined'
              ? localStorage.getItem(storageKeyModel) || localStorage.getItem('visor_opencode_model_global')
              : null;
          const savedVariant =
            typeof window !== 'undefined'
              ? localStorage.getItem(storageKeyVariant) || localStorage.getItem('visor_opencode_variant_global')
              : null;

          if (savedModel && data.models.some((m: any) => m.fullId === savedModel)) {
            setSelectedModel(savedModel);
            if (savedVariant) setSelectedVariant(savedVariant);
          } else if (data.defaultModel) {
            setSelectedModel(data.defaultModel);
          } else {
            setSelectedModel(data.models[0].fullId);
          }
        }
      }
    } catch {}
  };

  // Fetch agents list
  const fetchAgents = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/agents`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.agents) && data.agents.length > 0) {
          setAvailableAgents(data.agents);
        }
      }
    } catch {}
  };

  // Fetch VCS / Git Info
  const fetchVcs = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/vcs`);
      if (res.ok) {
        const data = await res.json();
        if (data.vcs) {
          setVcsInfo(data.vcs);
        }
      }
    } catch {}
  };

  // Fetch Session Todos Checklist
  const fetchSessionTodos = async (sessionId: string) => {
    if (!projectId || !sessionId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/sessions/${sessionId}/todo`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.todos)) {
          setTodos(data.todos);
        }
      }
    } catch {}
  };

  // Fetch project's Kanban tasks for quick linking & status changes
  const fetchKanbanTasks = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/kanban/tasks?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tasks)) {
          setKanbanTasks(data.tasks);
        }
      }
    } catch {}
  };

  // Handle task column change directly from chat
  const handleUpdateTaskColumn = async (taskId: string, newColumn: string) => {
    try {
      await fetch(`/api/kanban/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column: newColumn }),
      });
      setKanbanTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, column: newColumn } : t))
      );
    } catch (err) {
      console.error('Failed to update task column:', err);
    }
  };

  // Handle model change and persist to localStorage
  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    try {
      localStorage.setItem(storageKeyModel, modelId);
      localStorage.setItem('visor_opencode_model_global', modelId);
    } catch {}
  };

  // Handle variant change and persist to localStorage
  const handleSelectVariant = (variant: string) => {
    setSelectedVariant(variant);
    try {
      localStorage.setItem(storageKeyVariant, variant);
      localStorage.setItem('visor_opencode_variant_global', variant);
    } catch {}
  };

  // Handle agent change and persist to localStorage
  const handleSelectAgent = (agentName: string) => {
    setSelectedAgent(agentName);
    try {
      localStorage.setItem(storageKeyAgent, agentName);
    } catch {}
  };

  // 3. Fetch Sessions List for Project
  const fetchSessions = async (preferSessionId?: string) => {
    if (!projectId) return;
    setLoadingSessions(true);
    setGeneralError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/sessions`);
      const data = await res.json();
      if (data.host) {
        setHostInfo(data.host);
        if (data.host.id) {
          fetchModels(data.host.id);
        }
      }
      if (data.project?.deployPath) {
        setDeployDirectory(data.project.deployPath);
      }
      if (data.error && (!data.sessions || data.sessions.length === 0)) {
        setGeneralError(data.error);
      }
      const list: OpenCodeSessionSummary[] = Array.isArray(data.sessions) ? data.sessions : [];
      setSessions(list);

      // Select session
      if (preferSessionId) {
        setActiveSessionId(preferSessionId);
      } else if (!activeSessionId && list.length > 0) {
        setActiveSessionId(list[0].id);
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Ошибка загрузки сессий');
    } finally {
      setLoadingSessions(false);
    }
  };

  // 4. Fetch Messages for Active Session
  const fetchSessionMessages = async (sessionId: string, silent = false) => {
    if (!projectId || !sessionId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setDiff(data.diff || null);
        setIsGenerating(Boolean(data.isGenerating));
        if (!data.isGenerating) {
          setCloudflare524Notice(null);
        }

        // Sync model and variant with active session if returned
        if (data.model?.id) {
          const match = availableModels.find(
            (m) => m.fullId === data.model.id || m.id === data.model.id
          );
          if (match) {
            setSelectedModel(match.fullId);
            if (data.model.variant && match.variants?.includes(data.model.variant)) {
              setSelectedVariant(data.model.variant);
            }
          }
        }
        if (data.directory) {
          setDeployDirectory(data.directory);
        }

        // Also fetch session todos
        fetchSessionTodos(sessionId);
      }
    } catch (err: any) {
      if (!silent) {
        console.error('Failed to fetch session messages:', err);
      }
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  // Abort execution handler
  const handleAbortGeneration = async () => {
    if (!activeSessionId || !projectId) return;
    try {
      await fetch(`/api/projects/${projectId}/opencode/sessions/${activeSessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abort: true }),
      });
      setIsGenerating(false);
      fetchSessionMessages(activeSessionId);
    } catch (err) {
      console.error('Failed to abort generation:', err);
    }
  };

  // Revert a turn/message
  const handleRevertMessage = async (messageId: string) => {
    if (!activeSessionId || !projectId) return;
    if (!confirm('Откатить диалог и изменения до этого шага?')) return;
    setRevertingMsgId(messageId);
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/sessions/${activeSessionId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revert', messageId }),
      });
      if (res.ok) {
        await fetchSessionMessages(activeSessionId);
      } else {
        const d = await res.json();
        alert(d.error || 'Ошибка отката шага');
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка отката');
    } finally {
      setRevertingMsgId(null);
    }
  };

  // Fork session
  const handleForkSession = async () => {
    if (!activeSessionId || !projectId) return;
    setIsForking(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/sessions/${activeSessionId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Не удалось ответвить сессию');

      if (data.session?.id) {
        await fetchSessions(data.session.id);
        setActiveSessionId(data.session.id);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка ответвления сессии');
    } finally {
      setIsForking(false);
    }
  };

  // Share session
  const handleShareSession = async () => {
    if (!activeSessionId || !projectId) return;
    setIsSharing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/sessions/${activeSessionId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Не удалось создать публичную ссылку');
      if (data.share?.url) {
        setShareUrl(data.share.url);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка создания публичной ссылки');
    } finally {
      setIsSharing(false);
    }
  };

  // Unshare session
  const handleUnshareSession = async () => {
    if (!activeSessionId || !projectId) return;
    setIsSharing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/sessions/${activeSessionId}/share`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setShareUrl(null);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка отзыва ссылки');
    } finally {
      setIsSharing(false);
    }
  };

  // Explorer: Fetch directory files
  const fetchDirectoryFiles = async (dirPath?: string) => {
    if (!projectId) return;
    setLoadingFiles(true);
    try {
      const pathParam = dirPath !== undefined ? `?path=${encodeURIComponent(dirPath)}` : '';
      const res = await fetch(`/api/projects/${projectId}/opencode/files${pathParam}`);
      if (res.ok) {
        const data = await res.json();
        setFilesList(Array.isArray(data.files) ? data.files : []);
        setCurrentPath(data.path || '');
      }
    } catch (err) {
      console.error('Failed to list files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  // Explorer: Fetch file content
  const handleViewFileContent = async (filePath: string) => {
    if (!projectId) return;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/opencode/files?action=content&path=${encodeURIComponent(filePath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSelectedFileContent({ path: filePath, content: data.content || '' });
      }
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  };

  // Explorer: Perform Search
  const handleExecuteSearch = async () => {
    const q = searchQuery.trim();
    if (!q || !projectId) return;
    setLoadingSearch(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/opencode/search?type=${searchType}&q=${encodeURIComponent(q)}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(Array.isArray(data.results) ? data.results : []);
      }
    } catch (err) {
      console.error('Failed search:', err);
    } finally {
      setLoadingSearch(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchSessions(initialSessionId);
    fetchKanbanTasks();
    fetchAgents();
    fetchVcs();

    // Restore agent preference
    if (typeof window !== 'undefined') {
      const savedAgent = localStorage.getItem(storageKeyAgent);
      if (savedAgent) setSelectedAgent(savedAgent);
    }
  }, [projectId]);

  // Handle incoming Kanban task from navigation query parameters
  useEffect(() => {
    if (initialTaskId || initialTaskTitle) {
      setSelectedTaskId(initialTaskId || '');
      setInputPrompt(
        `Задача из Kanban: "${initialTaskTitle || 'Задача'}"\n\n` +
          `Пожалуйста, изучи кодовую базу в рабочей директории проекта и выполни эту задачу шаг за шагом.`
      );
      setTimeout(() => {
        textareaRef.current?.focus({ preventScroll: true });
      }, 300);
    }
  }, [initialTaskId, initialTaskTitle]);

  // Load messages when active session changes
  useEffect(() => {
    if (activeSessionId) {
      fetchSessionMessages(activeSessionId);
      setShareUrl(null);
    } else {
      setMessages([]);
      setDiff(null);
      setTodos([]);
    }
  }, [activeSessionId]);

  // Sync model with active session when active session changes
  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  useEffect(() => {
    if (activeSession?.model?.id && availableModels.length > 0) {
      const match = availableModels.find(
        (m) => m.fullId === activeSession.model?.id || m.id === activeSession.model?.id
      );
      if (match) {
        setSelectedModel(match.fullId);
        if (activeSession.model?.variant && match.variants?.includes(activeSession.model.variant)) {
          setSelectedVariant(activeSession.model.variant);
        }
      }
    }
    if (activeSession?.directory) {
      setDeployDirectory(activeSession.directory);
    }
  }, [activeSession, availableModels]);


  // Auto-polling when generation is running (every 1.5s for live tool steps)
  useEffect(() => {
    if (!isGenerating || !activeSessionId) return;

    const interval = setInterval(() => {
      fetchSessionMessages(activeSessionId, true);
    }, 1500);

    return () => clearInterval(interval);
  }, [isGenerating, activeSessionId]);

  // Create New Session
  const handleCreateSession = async () => {
    if (!projectId) return;
    setIsCreatingSession(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: deployDirectory || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не удалось создать сессию');
      if (data.session && data.session.id) {
        await fetchSessions(data.session.id);
        setActiveSessionId(data.session.id);
        setMessages([]);
        setDiff(null);
        setTodos([]);
        textareaRef.current?.focus({ preventScroll: true });
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка создания сессии');
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Start renaming session
  const handleStartRenameSession = (session: OpenCodeSessionSummary, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  // Cancel renaming
  const handleCancelRenameSession = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSessionId(null);
    setEditingTitle('');
  };

  // Save renamed session title
  const handleSaveRenameSession = async (
    sessionId: string,
    e?: React.FormEvent | React.MouseEvent
  ) => {
    if (e) e.preventDefault();
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setEditingSessionId(null);
      return;
    }
    setIsSavingSessionTitle(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось переименовать сессию');
      }
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed } : s))
      );
      setEditingSessionId(null);
    } catch (err: any) {
      alert(err.message || 'Ошибка переименования сессии');
    } finally {
      setIsSavingSessionTitle(false);
    }
  };

  // Trigger delete confirmation modal
  const handleConfirmDeleteSession = (session: OpenCodeSessionSummary, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSessionToDelete(session);
  };

  // Execute session deletion
  const handleExecuteDeleteSession = async () => {
    if (!sessionToDelete || !projectId) return;
    const targetId = sessionToDelete.id;
    setIsDeletingSession(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/sessions/${targetId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось удалить сессию');
      }
      const remaining = sessions.filter((s) => s.id !== targetId);
      setSessions(remaining);
      if (activeSessionId === targetId) {
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
      }
      setSessionToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления сессии');
    } finally {
      setIsDeletingSession(false);
    }
  };

  // Send Message Turn
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = inputPrompt.trim();
    if (!prompt || sendingMessage || isGenerating) return;

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      try {
        const createRes = await fetch(`/api/projects/${projectId}/opencode/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: prompt.slice(0, 50),
            directory: deployDirectory || undefined,
          }),
        });
        const createData = await createRes.json();
        if (createData?.session?.id) {
          targetSessionId = createData.session.id;
          setActiveSessionId(targetSessionId);
        } else {
          throw new Error('Не удалось инициализировать сессию');
        }
      } catch (err: any) {
        alert(err.message || 'Ошибка запуска сессии');
        return;
      }
    }

    // Optimistic user message in UI
    const tempUserMsgId = `temp_usr_${Date.now()}`;
    const optimisticUserMsg: OpenCodeChatMessage = {
      id: tempUserMsgId,
      role: 'user',
      text: prompt,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setInputPrompt('');
    setSendingMessage(true);
    setIsGenerating(true);
    setCloudflare524Notice(null);
    setTimeout(() => {
      scrollToBottom();
    }, 50);

    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/sessions/${targetSessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: selectedModel || undefined,
          variant: selectedVariant || undefined,
          reasoningEffort: selectedVariant || undefined,
          agent: selectedAgent || undefined,
        }),
      });

      const data = await res.json();

      if (data.isCloudflare524) {
        setCloudflare524Notice(
          'Запрос превысил 120 секунд (Cloudflare Proxy). OpenCode продолжает генерацию на сервере — Visor заберёт ответ автоматически.'
        );
        setIsGenerating(true);
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages);
        }
      } else if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при отправке сообщения в OpenCode');
      } else {
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages);
        } else if (data.textResponse) {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg_asst_${Date.now()}`,
              role: 'assistant',
              text: data.textResponse,
              completedAt: Date.now(),
            },
          ]);
        }
        if (data.diff) setDiff(data.diff);
        setIsGenerating(false);
      }

      fetchSessions(targetSessionId || undefined);
      if (targetSessionId) {
        fetchSessionTodos(targetSessionId);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка отправки сообщения');
      setIsGenerating(false);
    } finally {
      setSendingMessage(false);
    }
  };

  // Keyboard shortcut: Enter sends prompt, Shift+Enter adds newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Format markdown helper (renders simple code blocks with copy button)
  const renderMessageContent = (text: string, msgId: string) => {
    if (!text) return null;
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, idx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const firstLineEnd = part.indexOf('\n');
        const lang = firstLineEnd > 3 ? part.slice(3, firstLineEnd).trim() : '';
        const codeContent =
          firstLineEnd > 0 ? part.slice(firstLineEnd + 1, -3) : part.slice(3, -3);
        const codeId = `${msgId}_code_${idx}`;
        const isCopied = copiedId === codeId;

        return (
          <div
            key={idx}
            className="my-2 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 font-mono text-xs"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-slate-400">
              <span className="text-[11px] font-semibold text-slate-400">{lang || 'code'}</span>
              <button
                type="button"
                onClick={() => handleCopy(codeContent, codeId)}
                className="flex items-center gap-1 text-[11px] hover:text-cyan-400 transition-colors"
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {isCopied ? 'Скопировано!' : 'Копировать'}
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-slate-200 leading-relaxed font-mono whitespace-pre-wrap break-words">
              <code>{codeContent}</code>
            </pre>
          </div>
        );
      }

      return (
        <div key={idx} className="whitespace-pre-wrap leading-relaxed text-sm">
          {part}
        </div>
      );
    });
  };

  // Filtered sessions for sidebar
  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(sessionSearch.toLowerCase())
  );

  // Active session model display
  const activeSessionModelObj = useMemo(() => {
    return availableModels.find((m) => m.fullId === selectedModel);
  }, [availableModels, selectedModel]);

  // Current active step during generation
  const currentRunningStep = useMemo(() => {
    if (!isGenerating) return null;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.parts) {
      const runningPart = lastMsg.parts.find((p) => p.state?.status === 'running');
      if (runningPart) {
        if (runningPart.tool === 'bash') {
          return `Выполняется команда bash: ${runningPart.state?.input?.command || runningPart.state?.title || ''}`;
        }
        if (runningPart.tool === 'read') {
          return `Чтение файла: ${runningPart.state?.input?.filePath || ''}`;
        }
        if (runningPart.tool === 'write' || runningPart.tool === 'edit') {
          return `Редактирование файла: ${runningPart.state?.input?.filePath || ''}`;
        }
        return `Выполняется шаг: ${runningPart.tool}`;
      }
    }
    return 'OpenCode анализирует задачу и выполняет операции на сервере...';
  }, [isGenerating, messages]);

  // Count completed todos
  const completedTodosCount = useMemo(() => {
    return todos.filter((t) => t.status === 'completed').length;
  }, [todos]);

  return (
    <div
      className={`flex flex-col border border-slate-800 bg-[#0a0f1d] rounded-2xl overflow-hidden shadow-2xl relative ${className}`}
      style={{ minHeight: '700px', height: 'calc(100vh - 200px)' }}
    >
      {/* Top Header: Breadcrumbs & Active Status */}
      <div className="px-5 py-3 border-b border-slate-800/80 bg-[#0d1424] flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                OpenCode AI Диалог
              </h2>
              {project && (
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs text-slate-300 font-medium">
                  {project.title}
                </span>
              )}
              {activeSession && (
                <>
                  <span className="text-slate-600 hidden md:inline">/</span>
                  <span
                    className="text-xs font-semibold text-cyan-300 truncate max-w-[200px] hidden md:inline"
                    title={activeSession.title}
                  >
                    {activeSession.title}
                  </span>
                </>
              )}
            </div>

            {/* Sub-header badges: Server, Deploy Path, Git VCS, and Active Model */}
            <div className="flex items-center gap-2.5 mt-1 text-[11px] text-slate-400 flex-wrap font-mono">
              <span className="flex items-center gap-1">
                <Server className="w-3 h-3 text-cyan-400" />
                <span className="text-slate-300">{hostInfo?.name || project?.host?.name || 'Сервер'}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                <FolderOpen className="w-3 h-3 text-cyan-400" />
                <span>{deployDirectory || '/root'}</span>
              </span>
              {vcsInfo?.branch && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 font-medium">
                    <GitBranch className="w-3 h-3 text-emerald-400" />
                    <span>{vcsInfo.branch}</span>
                  </span>
                </>
              )}
              {activeSessionModelObj && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-950/40 border border-indigo-800/40 text-indigo-300 font-medium">
                    <Brain className="w-3 h-3 text-indigo-400" />
                    <span>
                      {activeSessionModelObj.name}
                      {selectedVariant ? ` (${selectedVariant})` : ''}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Todos / Checklist Badge Button */}
          {todos.length > 0 && (
            <button
              type="button"
              onClick={() => setIsTodosOpen(!isTodosOpen)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                isTodosOpen
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title="Задачи чек-листа OpenCode"
            >
              <ListTodo className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Чек-лист: {completedTodosCount}/{todos.length}
              </span>
            </button>
          )}

          {/* Files & Search Explorer Drawer Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsExplorerOpen(!isExplorerOpen);
              if (!isExplorerOpen && filesList.length === 0) {
                fetchDirectoryFiles(deployDirectory || '');
              }
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              isExplorerOpen
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="Файловый обозреватель и поиск по коду"
          >
            <FolderTree className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Файлы & Поиск</span>
          </button>

          {activeSession && (
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              {/* Share Button */}
              <button
                type="button"
                onClick={() => {
                  setIsShareModalOpen(true);
                  if (!shareUrl) handleShareSession();
                }}
                className="px-2.5 py-1 rounded-lg text-xs text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                title="Поделиться сессией по публичной ссылке"
              >
                <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">Поделиться</span>
              </button>

              {/* Fork Button */}
              <button
                type="button"
                onClick={handleForkSession}
                disabled={isForking}
                className="px-2.5 py-1 rounded-lg text-xs text-slate-300 hover:text-indigo-400 hover:bg-slate-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Ответвить (Fork) этот диалог в новую сессию"
              >
                {isForking ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <GitFork className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span className="hidden md:inline">Ответвить</span>
              </button>

              {/* Rename Button */}
              <button
                type="button"
                onClick={(e) => handleStartRenameSession(activeSession, e)}
                className="px-2.5 py-1 rounded-lg text-xs text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                title="Переименовать текущий диалог"
              >
                <Pencil className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Переименовать</span>
              </button>

              {/* Delete Button */}
              <button
                type="button"
                onClick={(e) => handleConfirmDeleteSession(activeSession, e)}
                className="px-2.5 py-1 rounded-lg text-xs text-slate-300 hover:text-rose-400 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                title="Удалить текущий диалог"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Удалить</span>
              </button>
            </div>
          )}

          {diff && (
            <button
              type="button"
              onClick={() => setIsDiffOpen(!isDiffOpen)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                isDiffOpen
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              {isDiffOpen ? 'Скрыть Diff' : 'Git Diff'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (activeSessionId) fetchSessionMessages(activeSessionId);
              fetchSessions();
              fetchVcs();
            }}
            disabled={loadingMessages || loadingSessions}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
            title="Обновить диалог"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingMessages || loadingSessions ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Main Workspace: Left Sidebar (Sessions) + Center Chat + Optional Right Explorer */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Sessions List */}
        <div className="w-72 border-r border-slate-800/80 bg-[#090d18] flex flex-col shrink-0">
          {/* New Chat Button */}
          <div className="p-3 border-b border-slate-800/80">
            <button
              type="button"
              onClick={handleCreateSession}
              disabled={isCreatingSession}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-500/20 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {isCreatingSession ? 'Создание...' : 'Новый диалог'}
            </button>

            {/* Session Search */}
            <div className="mt-2.5 relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                placeholder="Поиск диалогов..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingSessions && sessions.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 flex flex-col items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                Загрузка сессий...
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-8 px-4 text-xs text-slate-500">
                {sessionSearch
                  ? 'Сессии не найдены'
                  : 'Нет созданных диалогов. Нажмите «Новый диалог» выше.'}
              </div>
            ) : (
              filteredSessions.map((session) => {
                const isActive = session.id === activeSessionId;
                const isEditingThis = editingSessionId === session.id;
                const dateStr = session.createdAt
                  ? new Date(session.createdAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                if (isEditingThis) {
                  return (
                    <div
                      key={session.id}
                      className="w-full p-2.5 rounded-xl text-xs bg-slate-900 border border-cyan-500/60 shadow-lg"
                    >
                      <div className="flex items-center gap-1.5 mb-1.5 text-cyan-400">
                        <Pencil className="w-3 h-3 shrink-0" />
                        <span className="text-[10px] font-semibold">Переименовать</span>
                      </div>
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveRenameSession(session.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancelRenameSession();
                          }
                        }}
                        autoFocus
                        disabled={isSavingSessionTitle}
                        placeholder="Название диалога..."
                        className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none font-medium"
                      />
                      <div className="flex items-center justify-end gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={handleCancelRenameSession}
                          disabled={isSavingSessionTitle}
                          className="px-2 py-1 rounded-lg text-[11px] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Отмена (Esc)"
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveRenameSession(session.id)}
                          disabled={isSavingSessionTitle || !editingTitle.trim()}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors flex items-center gap-1 disabled:opacity-50"
                          title="Сохранить (Enter)"
                        >
                          {isSavingSessionTitle ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>ОК</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={session.id}
                    onClick={() => setActiveSessionId(session.id)}
                    className={`group relative w-full p-2.5 rounded-xl text-xs text-left transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-white font-medium shadow-md'
                        : 'bg-slate-900/40 hover:bg-slate-800/60 border-transparent hover:border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <MessageSquare
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-cyan-400' : 'text-slate-500'
                          }`}
                        />
                        <span className="truncate font-medium">{session.title}</span>
                      </div>

                      {/* Action buttons (Rename & Delete) */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleStartRenameSession(session, e)}
                          className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                          title="Переименовать"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleConfirmDeleteSession(session, e)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata: Date & Model */}
                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                      <span>{dateStr}</span>
                      {session.status === 'running' ? (
                        <span className="text-cyan-400 font-semibold animate-pulse">
                          Выполняется...
                        </span>
                      ) : session.model?.id ? (
                        <span className="px-1 py-0.2 rounded bg-slate-800/80 text-slate-400 font-mono text-[9px] truncate max-w-[90px]">
                          {session.model.id}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center: Dialogue & Inputs */}
        <div className="flex-1 flex flex-col bg-[#080d19] overflow-hidden">
          {/* Cloudflare 524 Banner */}
          {cloudflare524Notice && (
            <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{cloudflare524Notice}</span>
              </div>
              <button
                type="button"
                onClick={() => activeSessionId && fetchSessionMessages(activeSessionId)}
                className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-semibold shrink-0"
              >
                Синхронизировать сейчас
              </button>
            </div>
          )}

          {/* Session Todos Checklist Drawer */}
          {isTodosOpen && todos.length > 0 && (
            <div className="border-b border-slate-800 bg-[#0c1222] p-4 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-semibold text-slate-200">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-amber-400" />
                  <span>Чек-лист задач сессии OpenCode</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                    {completedTodosCount} из {todos.length} завершено
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTodosOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                {todos.map((todo, idx) => {
                  const isCompleted = todo.status === 'completed';
                  const isInProgress = todo.status === 'in_progress';
                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-xl text-xs flex items-center justify-between gap-3 border ${
                        isCompleted
                          ? 'bg-emerald-950/20 border-emerald-900/40 text-slate-300'
                          : isInProgress
                          ? 'bg-cyan-950/30 border-cyan-800/40 text-cyan-200 animate-pulse'
                          : 'bg-slate-900/60 border-slate-800/80 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : isInProgress ? (
                          <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <span className={`truncate ${isCompleted ? 'line-through text-slate-500' : ''}`}>
                          {todo.content}
                        </span>
                      </div>
                      {todo.priority && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-800 text-slate-400 shrink-0">
                          {todo.priority}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Git Diff Drawer */}
          {isDiffOpen && diff && (
            <div className="border-b border-slate-800 bg-slate-950 p-4 max-h-72 overflow-y-auto font-mono text-xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
                <div className="flex items-center gap-2 font-bold text-slate-200">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  Git Diff (изменения файлов в этой сессии)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(diff, 'diff_copy')}
                    className="text-xs hover:text-cyan-400 flex items-center gap-1 text-slate-400"
                  >
                    {copiedId === 'diff_copy' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedId === 'diff_copy' ? 'Скопировано' : 'Копировать diff'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDiffOpen(false)}
                    className="text-slate-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <pre className="text-slate-300 whitespace-pre font-mono leading-relaxed">
                {diff.split('\n').map((line, i) => {
                  const isAdd = line.startsWith('+') && !line.startsWith('+++');
                  const isDel = line.startsWith('-') && !line.startsWith('---');
                  const isHunk = line.startsWith('@@');
                  const lineClass = isAdd
                    ? 'text-emerald-400 bg-emerald-950/30'
                    : isDel
                    ? 'text-rose-400 bg-rose-950/30'
                    : isHunk
                    ? 'text-cyan-400 font-bold'
                    : 'text-slate-300';
                  return (
                    <div key={i} className={lineClass}>
                      {line}
                    </div>
                  );
                })}
              </pre>
            </div>
          )}

          {/* Messages Feed */}
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="flex-1 overflow-y-auto p-5 space-y-4 relative"
          >
            {loadingMessages && messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-xs">Загрузка сообщений...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3">
                  <Bot className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  {activeSession ? activeSession.title : 'Диалог с OpenCode AI'}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  OpenCode имеет доступ к кодовой базе проекта на сервере ({deployDirectory || '/root'}).
                  Задайте вопрос, опишите баг или выберите задачу Kanban для исполнения.
                </p>

                {/* Suggested prompt chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full text-left">
                  {[
                    'Проверь логи и статус контейнеров docker-compose',
                    'Найди и исправь ошибку в конфигурации',
                    'Добавь healthcheck эндпоинт',
                    'Проведи аудит безопасности сервиса',
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setInputPrompt(preset);
                        textareaRef.current?.focus({ preventScroll: true });
                      }}
                      className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700 text-xs text-slate-300 transition-all text-left"
                    >
                      💡 {preset}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                const timeStr = msg.createdAt
                  ? new Date(msg.createdAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      isUser ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                        isUser
                          ? 'bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white'
                          : 'bg-slate-900 border border-slate-700 text-cyan-400'
                      }`}
                    >
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-md ${
                        isUser
                          ? 'bg-cyan-600/20 border border-cyan-500/30 text-slate-100 rounded-tr-sm'
                          : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-sm'
                      }`}
                    >
                      {/* Message Meta */}
                      <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 mb-1.5">
                        <span className="font-semibold text-slate-300">
                          {isUser ? 'Вы' : 'OpenCode Agent'}
                        </span>
                        <div className="flex items-center gap-2">
                          {msg.model && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-cyan-400">
                              {msg.model}
                            </span>
                          )}
                          <span>{timeStr}</span>
                          {!isUser && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCopy(msg.text, msg.id)}
                                className="hover:text-cyan-400 transition-colors"
                                title="Скопировать ответ"
                              >
                                {copiedId === msg.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevertMessage(msg.id)}
                                disabled={revertingMsgId === msg.id}
                                className="hover:text-amber-400 transition-colors"
                                title="Откатить диалог и состояние до этого шага (Revert)"
                              >
                                {revertingMsgId === msg.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                                ) : (
                                  <RotateCcw className="w-3 h-3" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Tool Steps & Reasoning for Assistant Message */}
                      {!isUser && (
                        <MessageExecutionSteps
                          parts={msg.parts}
                          thinking={msg.thinking}
                          tokens={msg.tokens}
                          isGenerating={msg.isGenerating || isGenerating}
                          onCopy={handleCopy}
                          copiedId={copiedId}
                        />
                      )}

                      {/* Content */}
                      <div className="text-slate-100">
                        {renderMessageContent(msg.text, msg.id)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Active Execution Banner during generation */}
            {isGenerating && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-900 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                </div>
                <div className="flex-1 max-w-[85%] bg-slate-900/90 border border-cyan-500/30 rounded-2xl rounded-tl-sm p-3.5 shadow-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                    </span>
                    <span className="text-xs text-cyan-300 font-medium">
                      {currentRunningStep}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAbortGeneration}
                    className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                    title="Прервать выполнение задачи"
                  >
                    <StopCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Прервать</span>
                  </button>
                </div>
              </div>
            )}

            {isScrolledUp && (
              <div className="sticky bottom-2 flex justify-end pointer-events-none">
                <button
                  type="button"
                  onClick={scrollToBottom}
                  className="pointer-events-auto px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-slate-700 shadow-xl text-xs flex items-center gap-1.5 transition-all backdrop-blur-sm"
                  title="Прокрутить к последним сообщениям"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>К новым сообщениям</span>
                </button>
              </div>
            )}
          </div>

          {/* Bottom Chat Input Form */}
          <div className="p-3.5 border-t border-slate-800/80 bg-[#090d18]">
            {/* Quick Controls Bar: Agent, Kanban tasks, Model, Reasoning */}
            <div className="flex items-center gap-2 mb-2 flex-wrap text-xs">
              {/* Agent Mode Selector (Build, Plan, Explore) */}
              <div className="flex items-center gap-1">
                <select
                  value={selectedAgent}
                  onChange={(e) => handleSelectAgent(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-cyan-300 font-semibold rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500"
                  title="Режим агента OpenCode (Build: разработка, Plan: планирование, Explore: исследование)"
                >
                  {availableAgents.map((ag) => (
                    <option key={ag.name} value={ag.name}>
                      {ag.name === 'build' ? '🛠️ Режим: Build' : ag.name === 'plan' ? '📐 Режим: Plan (чтение)' : ag.name === 'explore' ? '🔍 Режим: Explore' : `🤖 ${ag.name}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Two-Way Kanban Task Dropdown & Status Updater */}
              {kanbanTasks.length > 0 && (
                <div className="flex items-center gap-1">
                  <select
                    value={selectedTaskId}
                    onChange={(e) => {
                      const tId = e.target.value;
                      setSelectedTaskId(tId);
                      const task = kanbanTasks.find((t: any) => t.id === tId);
                      if (task) {
                        setInputPrompt(
                          `Задача из Kanban: "${task.title}"\n` +
                            `Описание: ${task.description || 'Не указано'}\n` +
                            `Приоритет: ${task.priority}\n\n` +
                            `Пожалуйста, проанализируй файлы в рабочей директории ${deployDirectory || ''} и реши эту задачу.`
                        );
                        textareaRef.current?.focus({ preventScroll: true });
                      }
                    }}
                    className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500 font-sans max-w-[200px] truncate"
                  >
                    <option value="">📋 Задачи Kanban ({kanbanTasks.length})...</option>
                    {kanbanTasks.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        [{t.column}] {t.title}
                      </option>
                    ))}
                  </select>

                  {/* Task Column Quick Changer if a task is active */}
                  {selectedTaskId && (() => {
                    const task = kanbanTasks.find((t) => t.id === selectedTaskId);
                    if (!task) return null;
                    return (
                      <select
                        value={task.column}
                        onChange={(e) => handleUpdateTaskColumn(task.id, e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-cyan-400 font-mono rounded-lg px-2 py-1 text-[11px] focus:outline-none"
                        title="Изменить статус задачи в Kanban"
                      >
                        <option value="backlog">Бэклог</option>
                        <option value="todo">To Do</option>
                        <option value="in_progress">В работе</option>
                        <option value="review">Тест</option>
                        <option value="done">Готово</option>
                      </select>
                    );
                  })()}
                </div>
              )}

              {/* Model Picker (persisted in localStorage) */}
              {availableModels.length > 0 && (
                <select
                  value={selectedModel}
                  onChange={(e) => handleSelectModel(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  title="Модель OpenCode (сохраняется автоматически)"
                >
                  {availableModels.map((m) => (
                    <option key={m.fullId} value={m.fullId}>
                      🤖 {m.name || m.id}
                    </option>
                  ))}
                </select>
              )}

              {/* Reasoning Variant Selector (persisted in localStorage) */}
              {(() => {
                const currentModel = availableModels.find((m) => m.fullId === selectedModel);
                const variants = currentModel?.variants || [];
                const hasReasoning = currentModel ? currentModel.reasoning !== false : true;

                if (variants.length > 0) {
                  return (
                    <select
                      value={selectedVariant}
                      onChange={(e) => handleSelectVariant(e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-cyan-400 font-medium rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-cyan-500"
                      title="Уровень рассуждений OpenCode (сохраняется автоматически)"
                    >
                      <option value="">🧠 Ризонинг: Авто</option>
                      {variants.map((v) => (
                        <option key={v} value={v}>
                          🧠 Ризонинг: {formatVariantLabel(v)}
                        </option>
                      ))}
                    </select>
                  );
                }

                if (hasReasoning) {
                  return (
                    <span
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-1.5"
                      title="У этой модели рассуждения работают по умолчанию в постоянном режиме"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Ризонинг: Встроенный</span>
                    </span>
                  );
                }

                return (
                  <span
                    className="px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-500 flex items-center gap-1.5"
                    title="Данная модель не поддерживает рассуждения"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                    <span>Без ризонинга</span>
                  </span>
                );
              })()}
            </div>

            {/* Main Textarea and Send Button */}
            <form onSubmit={handleSendMessage} className="relative flex items-end gap-2">
              <textarea
                ref={textareaRef}
                rows={2}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Спросите OpenCode или поставьте задачу по кодовой базе проекта... (Enter — отправить, Shift+Enter — перенос)"
                disabled={sendingMessage || isGenerating}
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none resize-none transition-colors leading-relaxed disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={!inputPrompt.trim() || sendingMessage || isGenerating}
                className="h-[52px] px-5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 disabled:opacity-40 disabled:hover:from-cyan-500 disabled:hover:to-indigo-600 shrink-0"
              >
                {sendingMessage || isGenerating ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Отправить</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Drawer: File Explorer & Code Search */}
        {isExplorerOpen && (
          <div className="w-80 border-l border-slate-800 bg-[#090d18] flex flex-col shrink-0">
            {/* Header & Tabs */}
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setExplorerTab('files')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    explorerTab === 'files'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Файлы</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExplorerTab('search')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    explorerTab === 'search'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Поиск</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsExplorerOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Content */}
            {explorerTab === 'files' ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                  <span className="truncate">{currentPath || deployDirectory || '/'}</span>
                  <button
                    type="button"
                    onClick={() => fetchDirectoryFiles(currentPath)}
                    className="p-1 text-slate-400 hover:text-cyan-400"
                    title="Обновить список файлов"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingFiles ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {loadingFiles ? (
                  <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    Загрузка файлов...
                  </div>
                ) : filesList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">Папка пуста или нет доступа</div>
                ) : (
                  <div className="space-y-1">
                    {filesList.map((item, idx) => {
                      const isDir = item.type === 'directory';
                      return (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs flex items-center justify-between gap-2 group"
                        >
                          <div
                            className="flex items-center gap-2 truncate cursor-pointer flex-1"
                            onClick={() => {
                              if (isDir) {
                                fetchDirectoryFiles(item.path || item.name);
                              } else {
                                handleViewFileContent(item.path || item.name);
                              }
                            }}
                          >
                            {isDir ? (
                              <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            ) : (
                              <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            <span className="truncate text-slate-200">{item.name}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setInputPrompt((prev) => `${prev} @${item.name} `);
                              textareaRef.current?.focus({ preventScroll: true });
                            }}
                            className="opacity-0 group-hover:opacity-100 text-[10px] text-cyan-400 hover:underline px-1"
                            title="Вставить ссылку на файл в промпт"
                          >
                            + чат
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 flex flex-col space-y-3">
                {/* Search Form */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSearchType('file')}
                      className={`flex-1 py-1 rounded text-center font-medium ${
                        searchType === 'file'
                          ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      По имени (glob)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchType('content')}
                      className={`flex-1 py-1 rounded text-center font-medium ${
                        searchType === 'content'
                          ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      В коде (ripgrep)
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleExecuteSearch()}
                      placeholder={searchType === 'file' ? '*.ts, config...' : 'текст в файлах...'}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleExecuteSearch}
                      disabled={loadingSearch || !searchQuery.trim()}
                      className="px-2.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {loadingSearch ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {loadingSearch ? (
                    <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      Поиск по серверу...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      {searchQuery ? 'Ничего не найдено' : 'Введите запрос и нажмите поиск'}
                    </div>
                  ) : (
                    searchResults.map((resItem, idx) => {
                      const isString = typeof resItem === 'string';
                      const itemTitle = isString ? resItem : resItem.path || resItem.file || JSON.stringify(resItem);

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setInputPrompt((prev) => `${prev} @${itemTitle} `);
                            textareaRef.current?.focus({ preventScroll: true });
                          }}
                          className="p-2 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-mono cursor-pointer transition-colors text-slate-300 hover:text-cyan-300"
                          title="Нажмите, чтобы добавить файл в промпт"
                        >
                          <div className="truncate font-semibold">{itemTitle}</div>
                          {!isString && resItem.line && (
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {resItem.line}: {resItem.content || ''}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share Session Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Публичная ссылка OpenCode</h3>
                  <p className="text-xs text-slate-400">Поделиться сессией в режиме только для чтения</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              {shareUrl ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 font-semibold">Ссылка на диалог:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy(shareUrl, 'share_link')}
                        className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors"
                        title="Скопировать ссылку"
                      >
                        {copiedId === 'share_link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Открыть в новой вкладке"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                  <p className="text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-900/30 p-2.5 rounded-lg">
                    ✓ Сессия доступна по защищенной ссылке OpenCode без необходимости авторизации в Visor.
                  </p>
                </>
              ) : isSharing ? (
                <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                  Создание публичной ссылки...
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-300">
                    Нажмите кнопку ниже, чтобы сгенерировать защищенную веб-ссылку для этой сессии.
                  </p>
                  <button
                    type="button"
                    onClick={handleShareSession}
                    className="w-full py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md"
                  >
                    Сгенерировать ссылку
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              {shareUrl && (
                <button
                  type="button"
                  onClick={handleUnshareSession}
                  disabled={isSharing}
                  className="text-xs text-rose-400 hover:text-rose-300 hover:underline transition-colors"
                >
                  Отозвать ссылку (Unshare)
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Session Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white">Удалить диалог OpenCode?</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Вы уверены, что хотите удалить диалог{' '}
                  <span className="font-semibold text-white">«{sessionToDelete.title}»</span>?
                </p>
                <p className="text-[11px] text-rose-400/90 mt-2 bg-rose-950/30 border border-rose-900/30 rounded-lg p-2.5">
                  Сессия и вся история сообщений будут безвозвратно удалены на сервере OpenCode.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                disabled={isDeletingSession}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteSession}
                disabled={isDeletingSession}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                {isDeletingSession ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Удаление...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить диалог</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Content Preview Modal */}
      {selectedFileContent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101e] border border-slate-800 rounded-2xl max-w-2xl w-full p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 truncate">
                <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="font-mono text-xs text-white truncate">{selectedFileContent.path}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setInputPrompt((prev) => `${prev} @${selectedFileContent.path} `);
                    setSelectedFileContent(null);
                    textareaRef.current?.focus({ preventScroll: true });
                  }}
                  className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                >
                  Вставить в чат
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFileContent(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <pre className="flex-1 overflow-auto p-3 text-slate-200 text-xs font-mono leading-relaxed bg-black/60 rounded-xl my-3 border border-slate-900 whitespace-pre">
              {selectedFileContent.content}
            </pre>

            <div className="flex justify-end pt-2 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setSelectedFileContent(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
