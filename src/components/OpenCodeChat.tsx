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
  Folder,
  FolderOpen,
  FolderGit2,
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
  HelpCircle,
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
  isCurrentProject?: boolean;
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

        // Tool: Question
        if (tool === 'question') {
          const rawQ = state.input?.questions || state.input;
          const questionsList: any[] = Array.isArray(rawQ) ? rawQ : rawQ?.question ? [rawQ] : [];
          return (
            <div
              key={partId}
              className="p-3 rounded-xl border border-amber-500/40 bg-amber-950/20 text-xs shadow-sm space-y-1.5 font-sans"
            >
              <div className="flex items-center justify-between text-amber-400 font-semibold">
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Уточняющий вопрос от агента</span>
                </div>
                {isRunning ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Ожидает ответа пользователя
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                    <Check className="w-3 h-3" /> Ответ получен
                  </span>
                )}
              </div>
              {questionsList.map((q: any, qIdx: number) => (
                <div key={qIdx} className="text-slate-200">
                  {q.header && <span className="text-amber-300 font-bold mr-1.5">[{q.header}]</span>}
                  <span className="font-medium text-slate-100">{q.question}</span>
                </div>
              ))}
            </div>
          );
        }

        // Generic tool fallback (webfetch, todowrite, etc.)
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
  // OpenCode Projects on Host (GET /project and GET /project/current)
  const [openCodeProjects, setOpenCodeProjects] = useState<Array<{
    id: string;
    name?: string;
    worktree?: string;
    path?: string;
    directory?: string;
    vcs?: { branch?: string; default_branch?: string } | string;
    icon?: { color?: string; override?: string };
    sessionsCount?: number;
  }>>([]);
  const [currentOpenCodeProject, setCurrentOpenCodeProject] = useState<{
    id: string;
    name?: string;
    worktree?: string;
    path?: string;
    directory?: string;
    vcs?: { branch?: string; default_branch?: string } | string;
    icon?: { color?: string; override?: string };
    sessionsCount?: number;
  } | null>(null);
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);
  const [loadingOpenCodeProjects, setLoadingOpenCodeProjects] = useState(false);
  const [customDirInput, setCustomDirInput] = useState('');
  const [savingDir, setSavingDir] = useState(false);
  // Sessions filtering: only this project's sessions vs all host sessions
  const [filterOnlyCurrentProject, setFilterOnlyCurrentProject] = useState(true);
  const [totalHostSessionsCount, setTotalHostSessionsCount] = useState<number | null>(null);
  const [projectSessionsCount, setProjectSessionsCount] = useState<number | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Server Directory Browser Modal (DialogSelectDirectory)
  const [isDirPickerOpen, setIsDirPickerOpen] = useState(false);
  const [dirPickerPath, setDirPickerPath] = useState('/opt');
  const [dirPickerItems, setDirPickerItems] = useState<Array<{ name: string; path?: string; type: string }>>([]);
  const [loadingDirPicker, setLoadingDirPicker] = useState(false);

  // Edit Project Modal (DialogEditProject)
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<{
    id: string;
    name: string;
    worktree: string;
    color: string;
  } | null>(null);
  const [savingProjectEdit, setSavingProjectEdit] = useState(false);

  // Delete Project Modal (DialogDeleteProject)
  const [projectToDelete, setProjectToDelete] = useState<{
    id: string;
    name: string;
    worktree: string;
  } | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Pending questions from OpenCode server
  const [pendingQuestions, setPendingQuestions] = useState<Array<{
    id: string;
    sessionID: string;
    questions: Array<{
      header?: string;
      question: string;
      options: Array<{ label: string; description?: string }>;
      multiple?: boolean;
    }>;
  }>>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, Record<number, string[]>>>({});
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  // Encode directory for official OpenCode Web UI route (/:dir/session/:id)
  const encodeOpenCodeDirectoryRoute = (dir?: string | null): string => {
    if (!dir || dir.trim() === '' || dir.trim() === '/') return '';
    try {
      const t = new TextEncoder().encode(dir.trim());
      const n = Array.from(t, (r) => String.fromCharCode(r)).join('');
      return btoa(n).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch {
      return '';
    }
  };

  // Computed official OpenCode Web UI URL pointing directly to this project's directory & active session
  const opencodeWebUrl = useMemo(() => {
    const h = hostInfo || project?.host;
    if (!h) return null;
    const rawHost = h.opencodeHost || h.ip;
    if (!rawHost) return null;
    let base = '';
    if (rawHost.startsWith('http://') || rawHost.startsWith('https://')) {
      base = rawHost.replace(/\/+$/, '');
    } else {
      const proto = h.opencodeUseHttps ? 'https' : 'http';
      const port = h.opencodePort ? `:${h.opencodePort}` : '';
      base = `${proto}://${rawHost}${port}`;
    }
    const dirKey = encodeOpenCodeDirectoryRoute(deployDirectory);
    if (dirKey) {
      return activeSessionId ? `${base}/${dirKey}/session/${activeSessionId}` : `${base}/${dirKey}`;
    }
    return activeSessionId ? `${base}/session/${activeSessionId}` : base;
  }, [hostInfo, project?.host, deployDirectory, activeSessionId]);

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
  const fetchVcs = async (dir?: string) => {
    if (!projectId) return;
    try {
      const d = dir !== undefined ? dir : deployDirectory;
      const q = d ? `?directory=${encodeURIComponent(d)}` : '';
      const res = await fetch(`/api/projects/${projectId}/opencode/vcs${q}`);
      if (res.ok) {
        const data = await res.json();
        if (data.vcs) {
          setVcsInfo(data.vcs);
        }
      }
    } catch {}
  };

  // Fetch OpenCode projects on the host (GET /project and GET /project/current)
  const fetchOpenCodeProjects = async (targetDir?: string) => {
    if (!projectId) return;
    setLoadingOpenCodeProjects(true);
    try {
      const d = targetDir !== undefined ? targetDir : deployDirectory;
      const q = d ? `?directory=${encodeURIComponent(d)}` : '';
      const res = await fetch(`/api/projects/${projectId}/opencode/projects${q}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.projects)) {
          setOpenCodeProjects(data.projects);
        }
        if (data.current) {
          setCurrentOpenCodeProject(data.current);
        }
        if (data.deployPath && !deployDirectory) {
          setDeployDirectory(data.deployPath);
          setCustomDirInput(data.deployPath);
        }
        if (data.vcs && !vcsInfo) {
          setVcsInfo(data.vcs);
        }
      }
    } catch (err) {
      console.error('Failed to fetch OpenCode projects:', err);
    } finally {
      setLoadingOpenCodeProjects(false);
    }
  };

  // Switch or select OpenCode project / directory
  const handleSelectOpenCodeProject = async (targetPath: string, persistToVisor = true) => {
    const cleanPath = targetPath.trim();
    if (!cleanPath) return;

    setDeployDirectory(cleanPath);
    setCustomDirInput(cleanPath);

    // Immediately resolve and set currentOpenCodeProject from local list
    const cleanNorm = cleanPath.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
    const matched = openCodeProjects.find((p) => {
      const pNorm = ((p as any).canonical || p.worktree || p.path || p.directory || '').toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
      return pNorm === cleanNorm;
    });
    if (matched) {
      setCurrentOpenCodeProject(matched);
      if (matched.vcs) {
        setVcsInfo(typeof matched.vcs === 'string' ? { branch: matched.vcs } : matched.vcs);
      }
    } else {
      const folderName = cleanPath.split(/[/\\]/).filter(Boolean).pop() || cleanPath;
      setCurrentOpenCodeProject({
        id: cleanPath,
        name: folderName,
        worktree: cleanPath,
        path: cleanPath,
        directory: cleanPath,
      });
    }

    if (persistToVisor) {
      setSavingDir(true);
      try {
        await fetch(`/api/projects/${projectId}/opencode/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ directory: cleanPath }),
        });
      } catch (err) {
        console.error('Failed to save project directory:', err);
      } finally {
        setSavingDir(false);
      }
    }

    fetchVcs(cleanPath);
    fetchOpenCodeProjects(cleanPath);
    fetchSessions(undefined, cleanPath);
    if (isExplorerOpen) {
      fetchDirectoryFiles(cleanPath);
    }
    setIsProjectSelectorOpen(false);
  };

  // Directory Picker Modal Handlers
  const fetchDirPickerItems = async (dirPath: string) => {
    if (!projectId) return;
    setLoadingDirPicker(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/opencode/files?directory=${encodeURIComponent(dirPath)}&path=.`
      );
      if (res.ok) {
        const data = await res.json();
        const files: any[] = Array.isArray(data.files) ? data.files : [];
        setDirPickerItems(files);
        setDirPickerPath(dirPath);
      }
    } catch (err) {
      console.error('Failed to list files in directory picker:', err);
    } finally {
      setLoadingDirPicker(false);
    }
  };

  const handleOpenDirPicker = (startDir?: string) => {
    const start = startDir || deployDirectory || '/opt';
    fetchDirPickerItems(start);
    setIsDirPickerOpen(true);
  };

  const handleDirPickerNavigate = (folderPath: string) => {
    fetchDirPickerItems(folderPath);
  };

  const handleDirPickerSelect = (selectedPath: string) => {
    setIsDirPickerOpen(false);
    handleSelectOpenCodeProject(selectedPath, true);
  };

  // Edit Project Modal Handlers
  const handleOpenEditProject = (p: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const curPath = p.worktree || p.canonical || p.path || p.directory || deployDirectory;
    setEditingProject({
      id: p.id || 'global',
      name: p.name || curPath.split(/[/\\]/).filter(Boolean).pop() || 'Project',
      worktree: curPath,
      color: p.icon?.color || 'cyan',
    });
    setIsEditProjectModalOpen(true);
  };

  const handleSaveProjectEdit = async () => {
    if (!projectId || !editingProject) return;
    setSavingProjectEdit(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/projects`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: editingProject.id,
          name: editingProject.name,
          directory: editingProject.worktree,
          icon: editingProject.color ? { color: editingProject.color } : undefined,
        }),
      });
      if (res.ok) {
        // Immediate local state update
        setOpenCodeProjects((prev) =>
          prev.map((item) => {
            const itemPath = (item as any).canonical || item.worktree || item.path || item.directory || '';
            if (item.id === editingProject.id || itemPath === editingProject.worktree) {
              return { ...item, name: editingProject.name, icon: { color: editingProject.color } };
            }
            return item;
          })
        );
        setCurrentOpenCodeProject((prev) => {
          if (!prev) return prev;
          const prevPath = (prev as any).canonical || prev.worktree || prev.path || prev.directory || '';
          if (prev.id === editingProject.id || prevPath === editingProject.worktree) {
            return { ...prev, name: editingProject.name, icon: { color: editingProject.color } };
          }
          return prev;
        });
        setIsEditProjectModalOpen(false);
        fetchOpenCodeProjects(deployDirectory);
      }
    } catch (err) {
      console.error('Failed to save project edit:', err);
    } finally {
      setSavingProjectEdit(false);
    }
  };

  // Delete Project Handlers
  const handleConfirmDeleteProject = (p: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const curPath = (p as any).canonical || p.worktree || p.path || p.directory || deployDirectory || '';
    setProjectToDelete({
      id: p.id || curPath || 'global',
      name: p.name || curPath.split(/[/\\]/).filter(Boolean).pop() || 'Project',
      worktree: curPath,
    });
  };

  const handleExecuteDeleteProject = async () => {
    if (!projectToDelete || !projectId) return;
    setIsDeletingProject(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/opencode/projects`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectToDelete.id,
          directory: projectToDelete.worktree,
          unlinkDeployPath: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось удалить проект');
      }

      // Filter out deleted project from list
      const targetNorm = projectToDelete.worktree.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
      const remainingProjects = openCodeProjects.filter((p) => {
        const pNorm = ((p as any).canonical || p.worktree || p.path || p.directory || '').toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
        return pNorm !== targetNorm && p.id !== projectToDelete.id;
      });
      setOpenCodeProjects(remainingProjects);

      // If active project was deleted, switch to next available or reset
      const curNorm = (deployDirectory || '').toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
      if (curNorm === targetNorm) {
        if (remainingProjects.length > 0) {
          const nextPrj = remainingProjects[0];
          const nextPath = (nextPrj as any).canonical || nextPrj.worktree || nextPrj.path || nextPrj.directory || '';
          handleSelectOpenCodeProject(nextPath, true);
        } else {
          setDeployDirectory('');
          setCustomDirInput('');
          setCurrentOpenCodeProject(null);
          setVcsInfo(null);
          fetchSessions(undefined, '');
        }
      }

      setProjectToDelete(null);
      setIsEditProjectModalOpen(false);
      fetchOpenCodeProjects(deployDirectory);
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления проекта');
    } finally {
      setIsDeletingProject(false);
    }
  };

  // Fetch Session Todos Checklist
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

  // Fetch pending interactive questions from agent (GET /session/:id/question)
  const fetchSessionQuestions = async (sessionId: string) => {
    if (!projectId || !sessionId) return;
    try {
      const d = deployDirectory;
      const q = d ? `?directory=${encodeURIComponent(d)}` : '';
      const res = await fetch(`/api/projects/${projectId}/opencode/sessions/${sessionId}/question${q}`);
      if (res.ok) {
        const data = await res.json();
        const qList = Array.isArray(data.questions) ? data.questions : [];
        setPendingQuestions(qList);

        // Pre-select recommended or first option by default
        setSelectedAnswers((prev) => {
          const next = { ...prev };
          for (const item of qList) {
            if (!next[item.id]) {
              next[item.id] = {};
              (item.questions || []).forEach((q: any, idx: number) => {
                const recOption = q.options?.find(
                  (o: any) =>
                    o.label?.toLowerCase().includes('(recommended)') ||
                    o.label?.toLowerCase().includes('рекомендован')
                );
                const defaultOpt = recOption || q.options?.[0];
                if (defaultOpt) {
                  next[item.id][idx] = [defaultOpt.label];
                } else {
                  next[item.id][idx] = [];
                }
              });
            }
          }
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to fetch session questions:', err);
    }
  };

  // Select or toggle an option for a question
  const handleSelectOption = (
    questionId: string,
    qIdx: number,
    label: string,
    isMultiple = false
  ) => {
    setSelectedAnswers((prev) => {
      const currentQMap = prev[questionId] || {};
      const currentList = currentQMap[qIdx] || [];

      let newList: string[];
      if (isMultiple) {
        if (currentList.includes(label)) {
          newList = currentList.filter((item) => item !== label);
        } else {
          newList = [...currentList, label];
        }
      } else {
        newList = [label];
      }

      return {
        ...prev,
        [questionId]: {
          ...currentQMap,
          [qIdx]: newList,
        },
      };
    });
  };

  // Reply to question with selected answers
  const handleReplyQuestion = async (questionId: string) => {
    if (!projectId || !activeSessionId || isSubmittingAnswer) return;
    const qItem = pendingQuestions.find((q) => q.id === questionId);
    if (!qItem) return;

    const currentSelection = selectedAnswers[questionId] || {};
    const answers: string[][] = (qItem.questions || []).map((_, idx) => currentSelection[idx] || []);

    setIsSubmittingAnswer(true);
    try {
      const d = deployDirectory;
      const q = d ? `?directory=${encodeURIComponent(d)}` : '';
      const res = await fetch(
        `/api/projects/${projectId}/opencode/sessions/${activeSessionId}/question/${questionId}/reply${q}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers, directory: d || undefined }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось отправить ответ');
      }

      // Remove question from pending list and resume generation state
      setPendingQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setIsGenerating(true);

      setTimeout(() => {
        if (activeSessionId) {
          fetchSessionMessages(activeSessionId);
          fetchSessionQuestions(activeSessionId);
        }
      }, 800);
    } catch (err: any) {
      alert(err.message || 'Ошибка отправки ответа на вопрос');
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  // Reject / skip question
  const handleRejectQuestion = async (questionId: string) => {
    if (!projectId || !activeSessionId || isSubmittingAnswer) return;
    setIsSubmittingAnswer(true);
    try {
      const d = deployDirectory;
      const q = d ? `?directory=${encodeURIComponent(d)}` : '';
      const res = await fetch(
        `/api/projects/${projectId}/opencode/sessions/${activeSessionId}/question/${questionId}/reject${q}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ directory: d || undefined }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось отклонить вопрос');
      }

      setPendingQuestions((prev) => prev.filter((q) => q.id !== questionId));
      setIsGenerating(true);

      setTimeout(() => {
        if (activeSessionId) {
          fetchSessionMessages(activeSessionId);
          fetchSessionQuestions(activeSessionId);
        }
      }, 800);
    } catch (err: any) {
      alert(err.message || 'Ошибка отклонения вопроса');
    } finally {
      setIsSubmittingAnswer(false);
    }
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
  const fetchSessions = async (preferSessionId?: string, overrideDir?: string, showAllOverride?: boolean) => {
    if (!projectId) return;
    setLoadingSessions(true);
    setGeneralError(null);
    try {
      const d = overrideDir !== undefined ? overrideDir : deployDirectory;
      const shouldShowAll = showAllOverride !== undefined ? showAllOverride : !filterOnlyCurrentProject;
      const params = new URLSearchParams();
      if (d) params.set('directory', d);
      if (shouldShowAll) params.set('all', 'true');
      const q = params.toString() ? `?${params.toString()}` : '';

      const res = await fetch(`/api/projects/${projectId}/opencode/sessions${q}`);
      const data = await res.json();
      if (data.host) {
        setHostInfo(data.host);
        if (data.host.id) {
          fetchModels(data.host.id);
        }
      }
      if (data.project?.deployPath && !deployDirectory && !overrideDir) {
        setDeployDirectory(data.project.deployPath);
      }
      if (typeof data.allSessionsCount === 'number') {
        setTotalHostSessionsCount(data.allSessionsCount);
      }
      if (typeof data.projectSessionsCount === 'number') {
        setProjectSessionsCount(data.projectSessionsCount);
      }
      if (data.error && (!data.sessions || data.sessions.length === 0)) {
        setGeneralError(data.error);
      }
      const list: OpenCodeSessionSummary[] = Array.isArray(data.sessions) ? data.sessions : [];
      setSessions(list);

      // Select session
      if (preferSessionId && list.some((s) => s.id === preferSessionId)) {
        setActiveSessionId(preferSessionId);
      } else if (list.length > 0) {
        if (!activeSessionId || !list.some((s) => s.id === activeSessionId)) {
          setActiveSessionId(list[0].id);
        }
      } else {
        setActiveSessionId(null);
        setMessages([]);
        setDiff(null);
        setTodos([]);
      }
    } catch (err: any) {
      setGeneralError(err.message || 'Ошибка загрузки сессий');
    } finally {
      setLoadingSessions(false);
    }
  };

  // Хронологический порядок: старые вверху, новые внизу.
  // Бэкенд уже сортирует, но страхуемся и на фронте (API может отдать newest-first).
  const sortMessagesChronological = (list: OpenCodeChatMessage[]) =>
    [...list].sort((a, b) => {
      const ta = typeof a.createdAt === 'number' ? a.createdAt : null;
      const tb = typeof b.createdAt === 'number' ? b.createdAt : null;
      if (ta !== null && tb !== null && ta !== tb) return ta - tb;
      if (ta !== null && tb === null) return -1;
      if (ta === null && tb !== null) return 1;
      return 0;
    });

  // 4. Fetch Messages for Active Session
  const fetchSessionMessages = async (sessionId: string, silent = false) => {
    if (!projectId || !sessionId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const q = deployDirectory ? `?directory=${encodeURIComponent(deployDirectory)}` : '';
      const res = await fetch(`/api/projects/${projectId}/opencode/sessions/${sessionId}${q}`);
      if (res.ok) {
        const data = await res.json();
        const msgs = sortMessagesChronological(Array.isArray(data.messages) ? data.messages : []);
        if (silent) {
          // Во время live-polling не дёргаем скролл, если пользователь читает старые сообщения
          const el = messagesContainerRef.current;
          const wasNearBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 150 : true;
          setMessages(msgs);
          if (wasNearBottom) {
            setTimeout(() => scrollToBottom(), 50);
          }
        } else {
          setMessages(msgs);
          // После загрузки сессии показываем новые сообщения внизу
          setTimeout(() => scrollToBottom(), 50);
        }
        setDiff(data.diff || null);
        const generating = msgs.length > 0 && Boolean(data.isGenerating);
        setIsGenerating(generating);
        if (!generating) {
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

        // Also fetch session todos and pending questions
        fetchSessionTodos(sessionId);
        fetchSessionQuestions(sessionId);
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
      const dirParam = deployDirectory ? `${pathParam ? '&' : '?'}directory=${encodeURIComponent(deployDirectory)}` : '';
      const res = await fetch(`/api/projects/${projectId}/opencode/files${pathParam}${dirParam}`);
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
      const dirParam = deployDirectory ? `&directory=${encodeURIComponent(deployDirectory)}` : '';
      const res = await fetch(
        `/api/projects/${projectId}/opencode/files?action=content&path=${encodeURIComponent(filePath)}${dirParam}`
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
      const dirParam = deployDirectory ? `&directory=${encodeURIComponent(deployDirectory)}` : '';
      const res = await fetch(
        `/api/projects/${projectId}/opencode/search?type=${searchType}&q=${encodeURIComponent(q)}${dirParam}`
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
    fetchOpenCodeProjects();

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

  // Load messages and questions when active session changes
  useEffect(() => {
    if (activeSessionId) {
      fetchSessionMessages(activeSessionId);
      fetchSessionQuestions(activeSessionId);
      setShareUrl(null);
    } else {
      setMessages([]);
      setDiff(null);
      setTodos([]);
      setPendingQuestions([]);
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

  // Auto-polling when generation is running or questions are pending (every 1.5s for live tool steps)
  useEffect(() => {
    if (!activeSessionId) return;
    if (!isGenerating && pendingQuestions.length === 0) return;

    const interval = setInterval(() => {
      fetchSessionMessages(activeSessionId, true);
      fetchSessionQuestions(activeSessionId);
    }, 1500);

    return () => clearInterval(interval);
  }, [isGenerating, activeSessionId, pendingQuestions.length]);

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
      if (editingSessionId === targetId) {
        setEditingSessionId(null);
      }
      setSessionToDelete(null);
      fetchOpenCodeProjects(deployDirectory);
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

    // Detect linked Kanban task
    let linkedTaskId = selectedTaskId || undefined;
    if (!linkedTaskId) {
      const match = prompt.match(/Задача из Kanban: ["«]([^"»]+)["»]/i);
      if (match) {
        const found = kanbanTasks.find((t: any) => t.title.toLowerCase() === match[1].toLowerCase());
        if (found) linkedTaskId = found.id;
      }
    }

    if (linkedTaskId) {
      const modelTag = selectedModel ? (selectedModel.includes('/') ? selectedModel.split('/').pop() : selectedModel) : 'Agent';
      setKanbanTasks((prev) =>
        prev.map((t: any) =>
          t.id === linkedTaskId
            ? { ...t, column: 'in_progress', assigneeName: `OpenCode Agent (${modelTag})` }
            : t
        )
      );
    }

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
          directory: deployDirectory || undefined,
          taskId: linkedTaskId,
        }),
      });

      const data = await res.json();

      if (data.isCloudflare524) {
        setCloudflare524Notice(
          'Запрос превысил 120 секунд (Cloudflare Proxy). OpenCode продолжает генерацию на сервере — Visor заберёт ответ автоматически.'
        );
        setIsGenerating(true);
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(sortMessagesChronological(data.messages));
          setTimeout(() => scrollToBottom(), 50);
        }
      } else if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при отправке сообщения в OpenCode');
      } else {
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(sortMessagesChronological(data.messages));
          setTimeout(() => scrollToBottom(), 50);
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
          setTimeout(() => scrollToBottom(), 50);
        }
        if (data.diff) setDiff(data.diff);
        setIsGenerating(false);
      }

      fetchSessions(targetSessionId || undefined);
      if (targetSessionId) {
        fetchSessionTodos(targetSessionId);
      }
      fetchKanbanTasks();
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

  // Filtered sessions for sidebar (by title or directory)
  const filteredSessions = sessions.filter((s) => {
    const q = sessionSearch.toLowerCase();
    return s.title.toLowerCase().includes(q) || (s.directory && s.directory.toLowerCase().includes(q));
  });

  // Active session model display
  const activeSessionModelObj = useMemo(() => {
    return availableModels.find((m) => m.fullId === selectedModel);
  }, [availableModels, selectedModel]);

  // Current active step during generation
  const currentRunningStep = useMemo(() => {
    if (pendingQuestions.length > 0) {
      return 'Ожидает ответа пользователя на уточняющий вопрос агента...';
    }
    if (!isGenerating) return null;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.parts) {
      const runningPart = lastMsg.parts.find((p) => p.state?.status === 'running');
      if (runningPart) {
        if (runningPart.tool === 'question') {
          return 'Агент ожидает ответа пользователя на вопрос...';
        }
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
  }, [isGenerating, messages, pendingQuestions]);

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
                  {editingSessionId === activeSession.id ? (
                    <form
                      onSubmit={(e) => handleSaveRenameSession(activeSession.id, e)}
                      className="inline-flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancelRenameSession();
                          }
                        }}
                        autoFocus
                        disabled={isSavingSessionTitle}
                        className="bg-slate-950 border border-cyan-400 rounded px-2 py-0.5 text-xs text-white placeholder-slate-500 focus:outline-none font-semibold max-w-[240px]"
                      />
                      <button
                        type="submit"
                        disabled={isSavingSessionTitle || !editingTitle.trim()}
                        className="p-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors"
                        title="Сохранить (Enter)"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelRenameSession}
                        disabled={isSavingSessionTitle}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                        title="Отмена (Esc)"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleStartRenameSession(activeSession, e)}
                      className="group/title inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 hover:text-cyan-200 transition-colors truncate max-w-[240px] text-left"
                      title="Кликните для переименования диалога"
                    >
                      <span className="truncate">{activeSession.title}</span>
                      <Pencil className="w-3 h-3 opacity-0 group-hover/title:opacity-100 transition-opacity text-slate-400 shrink-0" />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Sub-header badges: Server, Deploy Path, Git VCS, and Active Model */}
            <div className="flex items-center gap-2.5 mt-1 text-[11px] text-slate-400 flex-wrap font-mono">
              <span className="flex items-center gap-1">
                <Server className="w-3 h-3 text-cyan-400" />
                <span className="text-slate-300">{hostInfo?.name || project?.host?.name || 'Сервер'}</span>
              </span>
              {/* Interactive OpenCode Project / Directory Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsProjectSelectorOpen(!isProjectSelectorOpen);
                    if (!isProjectSelectorOpen) {
                      fetchOpenCodeProjects(deployDirectory);
                    }
                  }}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer group"
                  title="Выбрать проект OpenCode или изменить рабочую директорию"
                >
                  {currentOpenCodeProject?.icon?.color ? (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: currentOpenCodeProject.icon.color }}
                    />
                  ) : (
                    <FolderGit2 className="w-3 h-3 text-cyan-400 group-hover:scale-110 transition-transform" />
                  )}
                  <span className="font-semibold text-white">
                    {currentOpenCodeProject?.name || (deployDirectory ? deployDirectory.split(/[/\\]/).filter(Boolean).pop() : 'OpenCode Проект')}
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline font-mono">
                    ({deployDirectory || '/root'})
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                </button>

                {/* Dropdown Menu */}
                {isProjectSelectorOpen && (
                  <div className="absolute left-0 top-full mt-2 w-84 sm:w-96 p-3 rounded-xl border border-slate-700 bg-slate-950/95 backdrop-blur-xl shadow-2xl z-50 text-xs font-sans space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <FolderGit2 className="w-4 h-4 text-cyan-400" />
                        <span>Проекты OpenCode на сервере</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => fetchOpenCodeProjects(deployDirectory)}
                          disabled={loadingOpenCodeProjects}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                          title="Обновить список проектов с сервера OpenCode"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loadingOpenCodeProjects ? 'animate-spin text-cyan-400' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsProjectSelectorOpen(false)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Current Resolved Project */}
                    {currentOpenCodeProject && (
                      <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/30 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
                            Текущий активный контекст
                          </span>
                          <div className="flex items-center gap-2">
                            {typeof currentOpenCodeProject.vcs === 'object' && currentOpenCodeProject.vcs?.branch && (
                              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                                <GitBranch className="w-3 h-3" />
                                <span>{currentOpenCodeProject.vcs.branch}</span>
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditProject(currentOpenCodeProject, e)}
                              className="text-slate-400 hover:text-cyan-400 p-0.5 rounded transition-colors"
                              title="Редактировать проект (имя, цвет)"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleConfirmDeleteProject(currentOpenCodeProject, e)}
                              className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors"
                              title="Удалить / отвязать проект"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="text-white font-semibold flex items-center gap-2">
                          {currentOpenCodeProject.icon?.color ? (
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: currentOpenCodeProject.icon.color }}
                            />
                          ) : (
                            <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          )}
                          <span className="truncate">{currentOpenCodeProject.name}</span>
                          {currentOpenCodeProject.sessionsCount !== undefined && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono">
                              {currentOpenCodeProject.sessionsCount} сессий
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 break-all">
                          {currentOpenCodeProject.worktree || currentOpenCodeProject.path || deployDirectory}
                        </div>
                      </div>
                    )}

                    {/* Detected Projects List */}
                    <div>
                      <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                        <span>Список проектов сервера (GET /project)</span>
                        <span className="text-[10px] text-slate-500">{openCodeProjects.length} обнаружено</span>
                      </div>

                      {loadingOpenCodeProjects ? (
                        <div className="py-4 text-center text-slate-500 flex items-center justify-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                          <span>Опрос сервера OpenCode...</span>
                        </div>
                      ) : openCodeProjects.length === 0 ? (
                        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-400 text-center">
                          На сервере OpenCode пока нет зарегистрированных проектов в базе. Выберите рабочую директорию вручную ниже.
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {openCodeProjects.map((p) => {
                            const pPath = (p as any).canonical || p.worktree || p.path || p.directory || '';
                            const isSelected = (deployDirectory || '').toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '') === pPath.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
                            const vcsLabel = typeof p.vcs === 'string' ? p.vcs : p.vcs?.branch || (p.vcs ? 'git' : null);
                            return (
                              <div
                                key={p.id || pPath}
                                className={`w-full text-left p-2 rounded-lg border transition-all flex items-start justify-between gap-2 ${
                                  isSelected
                                    ? 'bg-cyan-500/10 border-cyan-500/50 text-white shadow-sm'
                                    : 'bg-slate-900/80 hover:bg-slate-800/90 border-slate-800 text-slate-300'
                                }`}
                              >
                                <div
                                  className="min-w-0 flex-1 cursor-pointer"
                                  onClick={() => handleSelectOpenCodeProject(pPath, true)}
                                >
                                  <div className="font-semibold text-white flex items-center gap-1.5 truncate">
                                    {p.icon?.color ? (
                                      <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                                        style={{ backgroundColor: p.icon.color }}
                                      />
                                    ) : (
                                      <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                    )}
                                    <span className="truncate">{p.name || p.id}</span>
                                    {vcsLabel && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 font-mono shrink-0">
                                        {vcsLabel}
                                      </span>
                                    )}
                                    {p.sessionsCount !== undefined && p.sessionsCount > 0 && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-400 font-mono shrink-0">
                                        {p.sessionsCount} сессий
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                                    {pPath}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenEditProject(p, e)}
                                    className="p-1 text-slate-400 hover:text-cyan-400 rounded hover:bg-slate-800 transition-colors"
                                    title="Настройки проекта"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleConfirmDeleteProject(p, e)}
                                    className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                                    title="Удалить проект из OpenCode"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                  {isSelected ? (
                                    <span className="p-1 text-cyan-400">
                                      <Check className="w-3.5 h-3.5" />
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleSelectOpenCodeProject(pPath, true)}
                                      className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-400 transition-colors"
                                    >
                                      Выбрать
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Server File Tree Picker & Manual Directory Input */}
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">
                          Открыть папку на сервере:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenDirPicker(deployDirectory || '/opt')}
                          className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer font-medium"
                        >
                          <FolderTree className="w-3 h-3" />
                          <span>Обзор папок на сервере</span>
                        </button>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={customDirInput}
                          onChange={(e) => setCustomDirInput(e.target.value)}
                          placeholder="/opt/TaxiDisp или C:\projects\app"
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleSelectOpenCodeProject(customDirInput, true)}
                          disabled={savingDir || !customDirInput.trim()}
                          className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-bold transition-all disabled:opacity-50 shrink-0"
                        >
                          {savingDir ? 'Сохранение...' : 'Выбрать'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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

          {/* Direct link to OpenCode official Web UI */}
          {opencodeWebUrl && (
            <a
              href={opencodeWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-all flex items-center gap-1.5 shadow-sm hover:scale-[1.02]"
              title={`Открыть оригинальный веб-интерфейс OpenCode (${opencodeWebUrl})`}
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Web UI</span>
            </a>
          )}
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

            {/* Scope Toggle: Current Project vs All Host Sessions */}
            <div className="mt-2.5 flex items-center p-0.5 bg-slate-950/80 border border-slate-800/80 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => {
                  if (!filterOnlyCurrentProject) {
                    setFilterOnlyCurrentProject(true);
                    fetchSessions(undefined, deployDirectory, false);
                  }
                }}
                className={`flex-1 py-1 px-1.5 rounded-md font-medium text-center transition-all flex items-center justify-center gap-1 ${
                  filterOnlyCurrentProject
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
                }`}
                title="Показывать только сессии этого проекта и рабочей директории"
              >
                <span>Этот проект</span>
                {projectSessionsCount !== null && (
                  <span className="text-[10px] px-1 rounded bg-cyan-950/80 text-cyan-300 font-mono">
                    {projectSessionsCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (filterOnlyCurrentProject) {
                    setFilterOnlyCurrentProject(false);
                    fetchSessions(undefined, deployDirectory, true);
                  }
                }}
                className={`flex-1 py-1 px-1.5 rounded-md font-medium text-center transition-all flex items-center justify-center gap-1 ${
                  !filterOnlyCurrentProject
                    ? 'bg-indigo-500/20 text-indigo-300 font-semibold shadow-sm border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
                }`}
                title="Показать все сессии OpenCode со всех проектов на хосте"
              >
                <span>Все сессии</span>
                {totalHostSessionsCount !== null && (
                  <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-400 font-mono">
                    {totalHostSessionsCount}
                  </span>
                )}
              </button>
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
              <div className="text-center py-8 px-4 text-xs text-slate-500 space-y-2">
                {sessionSearch ? (
                  <p>Сессии не найдены по запросу «{sessionSearch}»</p>
                ) : filterOnlyCurrentProject && totalHostSessionsCount && totalHostSessionsCount > 0 ? (
                  <>
                    <p className="text-slate-400 font-medium">Нет сессий для этой рабочей папки</p>
                    <p className="text-[11px] text-slate-500">
                      На сервере есть {totalHostSessionsCount} сессий других проектов.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterOnlyCurrentProject(false);
                        fetchSessions(undefined, deployDirectory, true);
                      }}
                      className="mt-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-[11px] transition-colors"
                    >
                      Показать все ({totalHostSessionsCount})
                    </button>
                  </>
                ) : (
                  <p>Нет созданных диалогов. Нажмите «Новый диалог» выше.</p>
                )}
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
                    onDoubleClick={(e) => handleStartRenameSession(session, e)}
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
                      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleStartRenameSession(session, e)}
                          className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                          title="Переименовать диалог"
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

                    {/* Directory Badge when viewing all sessions or for sessions outside active directory */}
                    {session.directory && (!filterOnlyCurrentProject || !session.isCurrentProject) && (
                      <div className="mt-1.5 flex items-center gap-1 text-[9.5px] text-slate-400 font-mono bg-slate-950/70 px-1.5 py-0.5 rounded border border-slate-800/80">
                        <Folder className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                        <span className="truncate" title={session.directory}>
                          {session.directory.split(/[/\\]/).filter(Boolean).slice(-2).join('/') || session.directory}
                        </span>
                        {session.isCurrentProject ? (
                          <span className="ml-auto text-[8.5px] text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-1 rounded shrink-0">
                            этот проект
                          </span>
                        ) : null}
                      </div>
                    )}
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

            {/* Active Execution Banner during generation or when agent asks a question */}
            {(isGenerating || pendingQuestions.length > 0) && (
              <div className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-xl bg-slate-900 border text-center flex items-center justify-center shrink-0 ${
                    pendingQuestions.length > 0
                      ? 'border-amber-500/40 text-amber-400'
                      : 'border-cyan-500/40 text-cyan-400'
                  }`}
                >
                  {pendingQuestions.length > 0 ? (
                    <HelpCircle className="w-4 h-4 text-amber-400 animate-pulse" />
                  ) : (
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  )}
                </div>
                <div
                  className={`flex-1 max-w-[85%] bg-slate-900/90 border rounded-2xl rounded-tl-sm p-3.5 shadow-lg flex items-center justify-between gap-3 ${
                    pendingQuestions.length > 0
                      ? 'border-amber-500/30'
                      : 'border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          pendingQuestions.length > 0 ? 'bg-amber-400' : 'bg-cyan-400'
                        }`}
                      ></span>
                      <span
                        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                          pendingQuestions.length > 0 ? 'bg-amber-500' : 'bg-cyan-500'
                        }`}
                      ></span>
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        pendingQuestions.length > 0 ? 'text-amber-300' : 'text-cyan-300'
                      }`}
                    >
                      {currentRunningStep}
                    </span>
                  </div>
                  {isGenerating && (
                    <button
                      type="button"
                      onClick={handleAbortGeneration}
                      className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
                      title="Прервать выполнение задачи"
                    >
                      <StopCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Прервать</span>
                    </button>
                  )}
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
            {/* Interactive OpenCode Pending Question(s) Box */}
            {pendingQuestions.length > 0 && (
              <div className="mb-3.5 p-4 rounded-xl border border-amber-500/50 bg-gradient-to-b from-amber-950/40 to-slate-950/90 shadow-2xl space-y-3.5">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                    <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                    <span>Уточняющий вопрос от OpenCode Agent ({pendingQuestions.length})</span>
                  </div>
                  <span className="text-[10px] text-amber-400/90 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/25 font-mono">
                    Выберите вариант для продолжения работы
                  </span>
                </div>

                {pendingQuestions.map((qGroup) => (
                  <div key={qGroup.id} className="space-y-3.5">
                    {qGroup.questions.map((q, qIdx) => {
                      const selectedForThisQ = selectedAnswers[qGroup.id]?.[qIdx] || [];
                      const isMulti = Boolean(q.multiple);

                      return (
                        <div key={qIdx} className="space-y-2">
                          <div className="text-xs text-white">
                            {q.header && (
                              <span className="font-bold text-amber-300 mr-2 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                                {q.header}
                              </span>
                            )}
                            <span className="font-semibold text-slate-100">{q.question}</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                            {(q.options || []).map((opt) => {
                              const isSelected = selectedForThisQ.includes(opt.label);
                              const isRec =
                                opt.label.toLowerCase().includes('recommended') ||
                                opt.label.toLowerCase().includes('рекомендован');

                              return (
                                <button
                                  key={opt.label}
                                  type="button"
                                  onClick={() => handleSelectOption(qGroup.id, qIdx, opt.label, isMulti)}
                                  className={`p-3 rounded-xl border text-left text-xs transition-all flex flex-col justify-between cursor-pointer ${
                                    isSelected
                                      ? 'border-amber-400 bg-amber-500/20 text-white shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/30'
                                      : 'border-slate-800 bg-slate-900/70 hover:bg-slate-850 hover:border-slate-700 text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2 w-full">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span
                                        className={`font-semibold ${
                                          isSelected ? 'text-amber-300' : 'text-slate-100'
                                        }`}
                                      >
                                        {opt.label}
                                      </span>
                                    </div>
                                    {isSelected ? (
                                      <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                    ) : (
                                      <Circle className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                                    )}
                                  </div>
                                  {opt.description && (
                                    <p className="mt-2 text-[11px] text-slate-400 leading-relaxed font-sans">
                                      {opt.description}
                                    </p>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => handleRejectQuestion(qGroup.id)}
                        disabled={isSubmittingAnswer}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
                      >
                        Отклонить / Пропустить
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReplyQuestion(qGroup.id)}
                        disabled={isSubmittingAnswer}
                        className="px-5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingAnswer ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Отправить ответ агенту</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

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
                        if (task.column === 'todo' || task.column === 'backlog') {
                          handleUpdateTaskColumn(task.id, 'in_progress');
                        }
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

            {/* Active Linked Task Pill */}
            {selectedTaskId && (() => {
              const activeTask = kanbanTasks.find((t: any) => t.id === selectedTaskId);
              if (!activeTask) return null;
              return (
                <div className="mb-2 p-2 px-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                    <span className="text-cyan-300 font-medium truncate">
                      Привязана задача Kanban: <strong className="text-white">{activeTask.title}</strong>
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-300 shrink-0">
                      {activeTask.column === 'in_progress' ? 'В работе' : activeTask.column}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateTaskColumn(activeTask.id, 'done')}
                      className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold transition-colors"
                      title="Отметить выполненной в Kanban"
                    >
                      ✓ Завершить
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId('')}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors text-[10px]"
                      title="Отвязать задачу от текущего промпта"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })()}

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

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white">Удалить проект OpenCode?</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Вы уверены, что хотите удалить проект{' '}
                  <span className="font-semibold text-white">«{projectToDelete.name}»</span>?
                </p>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400 break-all mt-2 select-all">
                  {projectToDelete.worktree}
                </div>
                <p className="text-[11px] text-rose-400/90 mt-2.5 bg-rose-950/30 border border-rose-900/30 rounded-lg p-2.5 leading-relaxed">
                  Проект будет удален из реестра OpenCode на сервере и отвязан от Visor. Исходные файлы проекта в файловой системе останутся сохранены.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                disabled={isDeletingProject}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteProject}
                disabled={isDeletingProject}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors flex items-center gap-1.5 shadow-lg shadow-rose-600/20 disabled:opacity-50"
              >
                {isDeletingProject ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Удаление...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить проект</span>
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

      {/* Server Directory Browser Modal (DialogSelectDirectory) */}
      {isDirPickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#090d18] border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Выбрать папку на сервере</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDirPickerOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick shortcuts & Current path */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pb-1">
                <span className="text-slate-500 shrink-0">Быстрый переход:</span>
                {['/opt', '/home', '/var', '/root'].map((qp) => (
                  <button
                    key={qp}
                    type="button"
                    onClick={() => handleDirPickerNavigate(qp)}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-400 font-mono border border-slate-800 shrink-0 transition-colors"
                  >
                    {qp}
                  </button>
                ))}
              </div>

              {/* Path Bar + Up Button */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const parts = dirPickerPath.replace(/\/+$/, '').split('/');
                    parts.pop();
                    const parent = parts.join('/') || '/';
                    handleDirPickerNavigate(parent);
                  }}
                  disabled={dirPickerPath === '/' || dirPickerPath === ''}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded text-xs font-mono transition-colors"
                  title="На уровень выше (..)"
                >
                  ..
                </button>
                <div className="flex-1 font-mono text-xs text-white truncate px-1">
                  {dirPickerPath || '/'}
                </div>
                <button
                  type="button"
                  onClick={() => fetchDirPickerItems(dirPickerPath)}
                  className="p-1 text-slate-400 hover:text-cyan-400"
                  title="Обновить"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDirPicker ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Directory items list */}
            <div className="flex-1 overflow-y-auto my-3 border border-slate-800/80 rounded-xl bg-slate-950/70 p-2 space-y-1 min-h-[200px] max-h-72">
              {loadingDirPicker ? (
                <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                  <span>Чтение файловой системы...</span>
                </div>
              ) : dirPickerItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  В этой папке нет подпапок или файлов
                </div>
              ) : (
                dirPickerItems
                  .filter((item) => item.type === 'directory')
                  .map((item, idx) => {
                    const cleanBase = dirPickerPath.replace(/\/+$/, '');
                    const fullChildPath = `${cleanBase}/${item.name}`;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleDirPickerNavigate(fullChildPath)}
                        className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800/90 text-xs flex items-center justify-between cursor-pointer border border-slate-800/60 transition-colors group"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Folder className="w-4 h-4 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="font-medium text-slate-200 truncate">{item.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100 font-mono transition-opacity">
                          открыть →
                        </span>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px] truncate max-w-[200px] font-mono">
                {dirPickerPath}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDirPickerOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => handleDirPickerSelect(dirPickerPath)}
                  className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-cyan-500/20"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Выбрать эту папку</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal (DialogEditProject) */}
      {isEditProjectModalOpen && editingProject && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101e] border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Настройки проекта OpenCode</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditProjectModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Название проекта
                </label>
                <input
                  type="text"
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  placeholder="TaxiDisp"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Цвет значка
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { name: 'cyan', color: '#06b6d4' },
                    { name: 'pink', color: '#ec4899' },
                    { name: 'emerald', color: '#10b981' },
                    { name: 'amber', color: '#f59e0b' },
                    { name: 'purple', color: '#a855f7' },
                    { name: 'blue', color: '#3b82f6' },
                    { name: 'rose', color: '#f43f5e' },
                  ].map((preset) => {
                    const isPicked = editingProject.color === preset.name || editingProject.color === preset.color;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setEditingProject({ ...editingProject, color: preset.name })}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                          isPicked ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: preset.color }}
                        title={preset.name}
                      >
                        {isPicked && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Рабочая директория на сервере
                </label>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
                  {editingProject.worktree}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsEditProjectModalOpen(false);
                  handleConfirmDeleteProject(editingProject);
                }}
                disabled={savingProjectEdit}
                className="px-3 py-1.5 rounded-xl text-rose-400 hover:text-white hover:bg-rose-500/20 font-semibold transition-colors flex items-center gap-1.5"
                title="Удалить проект из OpenCode"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить проект</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditProjectModalOpen(false)}
                  disabled={savingProjectEdit}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSaveProjectEdit}
                  disabled={savingProjectEdit || !editingProject.name.trim()}
                  className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  {savingProjectEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Сохранение...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Сохранить</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
