import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp?: number | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(timestamp?: number | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  idea: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    dot: 'bg-purple-400',
    label: 'Идея',
  },
  backlog: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    dot: 'bg-slate-400',
    label: 'Бэклог',
  },
  in_dev: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400 animate-pulse',
    label: 'В разработке',
  },
  staging: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400',
    label: 'Staging',
  },
  production: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
    label: 'Production',
  },
  paused: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    dot: 'bg-orange-400',
    label: 'Приостановлен',
  },
  archived: {
    bg: 'bg-zinc-600/10',
    text: 'text-zinc-400',
    border: 'border-zinc-600/30',
    dot: 'bg-zinc-500',
    label: 'В архиве',
  },
};

export const CATEGORY_ICONS: Record<string, string> = {
  website: 'Globe',
  saas: 'Sparkles',
  bot: 'Bot',
  crm: 'LayoutDashboard',
  script: 'Terminal',
  api: 'Server',
  system: 'Cpu',
  idea: 'Lightbulb',
  mobile: 'Smartphone',
};

export const RUNTIME_LABELS: Record<string, string> = {
  docker_compose: 'Docker Compose',
  docker_standalone: 'Docker Container',
  kubernetes: 'Kubernetes (K8s)',
  docker_swarm: 'Docker Swarm',
  coolify_portainer: 'Coolify / Portainer',
  systemd_service: 'Systemd Service',
  pm2: 'PM2 Process',
  cron: 'Cron Schedule',
  nomad: 'HashiCorp Nomad',
  manual: 'Manual Exec',
  serverless: 'Serverless / Worker',
};

export const DEPLOY_AUTOMATION_LABELS: Record<string, string> = {
  github_actions: 'GitHub Actions (CI/CD)',
  jenkins: 'Jenkins CI',
  gitlab_ci: 'GitLab CI/CD',
  argocd: 'ArgoCD GitOps',
  webhook: 'Webhook Trigger',
  manual_ssh: 'Ручной SSH вход',
  local_script: 'Локальный скрипт',
};

export const RELATION_LABELS: Record<string, { label: string; color: string }> = {
  depends_on: { label: 'Зависит от', color: '#f59e0b' },
  api_calls: { label: 'Вызывает API', color: '#06b6d4' },
  database_shared: { label: 'Общая БД', color: '#8b5cf6' },
  webhook_events: { label: 'Отправляет вебхуки', color: '#10b981' },
  auth_provider: { label: 'Провайдер авторизации', color: '#ec4899' },
  submodule: { label: 'Подмодуль / библиотека', color: '#64748b' },
};

export const SECRETS_TYPE_LABELS: Record<string, { label: string; badge: string; icon: string; description: string; placeholder: string }> = {
  dotenv: {
    label: 'Файл .env / System Env',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    icon: 'FileKey',
    description: 'Локальные переменные окружения (.env, .env.production)',
    placeholder: '.env или .env.production',
  },
  vault: {
    label: 'HashiCorp Vault',
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    icon: 'Lock',
    description: 'Централизованное защищенное хранилище секретов HashiCorp Vault',
    placeholder: 'secret/data/my-service или kv/prod/app',
  },
  k8s_secrets: {
    label: 'Kubernetes Secrets',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    icon: 'Shield',
    description: 'Нативные секреты K8s (Secret / SealedSecret / ExternalSecret)',
    placeholder: 'k8s secret name (например: app-secrets-v1)',
  },
  docker_secrets: {
    label: 'Docker Secrets',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    icon: 'Box',
    description: 'Docker Swarm / Compose secrets mount (/run/secrets)',
    placeholder: '/run/secrets/app_api_key',
  },
  doppler_infisical: {
    label: 'Doppler / Infisical',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    icon: 'KeyRound',
    description: 'Облачная платформа секретов Doppler или Self-hosted Infisical',
    placeholder: 'Doppler Project: "crm" / Config: "prd"',
  },
  aws_secrets: {
    label: 'Cloud Secrets (AWS / GCP / Cloud)',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    icon: 'Cloud',
    description: 'AWS Secrets Manager / GCP Secret Manager / Yandex Lockbox',
    placeholder: 'arn:aws:secretsmanager:... или lockbox secret ID',
  },
  cicd_secrets: {
    label: 'CI/CD Secrets (GitHub / GitLab)',
    badge: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
    icon: 'GitBranch',
    description: 'Секреты репозитория GitHub Actions / GitLab CI Variables',
    placeholder: 'Repository Secrets: GITHUB_TOKEN, PROD_KEY',
  },
  hardcode: {
    label: 'В коде / Хардкод (Небезопасно ⚠️)',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    icon: 'AlertTriangle',
    description: 'Вшиты в код или репозиторий. Высокий риск утечки!',
    placeholder: 'config.py / settings.json (Не рекомендуется!)',
  },
};

/**
 * Transliterates Cyrillic text to Latin, replaces non-alphanumeric characters,
 * collapses consecutive hyphens, and trims hyphens from edges.
 */
export function slugify(text: string): string {
  if (!text) return '';
  const cyrillicMap: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
    з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
    я: 'ya',
    і: 'i', ї: 'yi', є: 'ye', ґ: 'g',
  };

  const str = text.toLowerCase().trim();
  let result = '';
  for (const char of str) {
    if (cyrillicMap[char] !== undefined) {
      result += cyrillicMap[char];
    } else {
      result += char;
    }
  }

  return result
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Robust clipboard copy with navigator.clipboard and execCommand textarea fallback.
 * Returns true on actual success, false on failure.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  if (typeof window === 'undefined') return false;

  // 1. Try modern navigator.clipboard
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  // 2. Fallback using temporary textarea
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

