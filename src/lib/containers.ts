export type ContainerServiceType =
  | 'web'
  | 'api'
  | 'database'
  | 'cache'
  | 'worker'
  | 'queue'
  | 'proxy'
  | 'cron'
  | 'other';

export type PortProtocolType =
  | 'http'
  | 'https'
  | 'tcp'
  | 'udp'
  | 'grpc'
  | 'ws';

export interface ProjectContainer {
  id: string;
  name: string; // Service or component name (e.g. "web", "api", "postgres", "redis", "worker")
  type: ContainerServiceType; // Type of service
  containerName?: string | null; // Docker container or k8s deployment name
  port?: number | null; // Exposed internal port
  portType?: PortProtocolType; // Protocol / type of port (http, https, tcp, udp, grpc, ws)
  isPublic?: boolean; // Exposed to internet
}

export interface ContainerTypeMeta {
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  defaultPort?: number;
  defaultPortType?: PortProtocolType;
}

export const CONTAINER_TYPES: Record<ContainerServiceType, ContainerTypeMeta> = {
  web: {
    label: 'Веб / Фронтенд (Next.js, Vite, React, Vue)',
    shortLabel: 'Web',
    icon: '🌐',
    color: '#06b6d4', // cyan
    defaultPort: 3000,
    defaultPortType: 'http',
  },
  api: {
    label: 'API / Бэкенд (Node.js, Go, Python, Nest, Fastify)',
    shortLabel: 'API',
    icon: '⚙️',
    color: '#10b981', // emerald
    defaultPort: 8080,
    defaultPortType: 'http',
  },
  database: {
    label: 'База данных (PostgreSQL, MySQL, ClickHouse, Mongo)',
    shortLabel: 'DB',
    icon: '🗄️',
    color: '#6366f1', // indigo
    defaultPort: 5432,
    defaultPortType: 'tcp',
  },
  cache: {
    label: 'Кэш / In-Memory (Redis, KeyDB, Memcached, Dragonfly)',
    shortLabel: 'Cache',
    icon: '⚡',
    color: '#f59e0b', // amber
    defaultPort: 6379,
    defaultPortType: 'tcp',
  },
  worker: {
    label: 'Фоновый воркер / Consumer (Celery, BullMQ, Go)',
    shortLabel: 'Worker',
    icon: '👷',
    color: '#a855f7', // purple
    defaultPort: undefined,
    defaultPortType: undefined,
  },
  queue: {
    label: 'Очередь сообщений (RabbitMQ, Kafka, NATS, SQS)',
    shortLabel: 'Queue',
    icon: '📬',
    color: '#f43f5e', // rose
    defaultPort: 5672,
    defaultPortType: 'tcp',
  },
  proxy: {
    label: 'Реверс-прокси / Ingress (Nginx, Traefik, Caddy)',
    shortLabel: 'Proxy',
    icon: '🛡️',
    color: '#38bdf8', // sky
    defaultPort: 80,
    defaultPortType: 'http',
  },
  cron: {
    label: 'Периодическая задача / Cron Job',
    shortLabel: 'Cron',
    icon: '⏱️',
    color: '#64748b', // slate
    defaultPort: undefined,
    defaultPortType: undefined,
  },
  other: {
    label: 'Другой сервис / Микросервис',
    shortLabel: 'Other',
    icon: '📦',
    color: '#94a3b8', // slate-400
    defaultPort: undefined,
    defaultPortType: 'http',
  },
};

export const PORT_PROTOCOLS: Record<PortProtocolType, { label: string; description: string }> = {
  http: { label: 'HTTP', description: 'Обычный веб-трафик и REST API' },
  https: { label: 'HTTPS', description: 'Защищенный TLS/SSL трафик' },
  tcp: { label: 'TCP', description: 'Базы данных, брокеры, сырой сокет' },
  udp: { label: 'UDP', description: 'Стриминг медиа, DNS, VoIP' },
  grpc: { label: 'gRPC', description: 'Высокопроизводительный RPC протокол' },
  ws: { label: 'WebSocket', description: 'Полнодуплексные реалтайм соединения' },
};

/**
 * Normalizes container list from deployment data.
 * Fallbacks to synthesizing a primary container if legacy internalPort / containerName exists.
 */
export function normalizeContainers(deployment: any): ProjectContainer[] {
  if (!deployment) return [];

  let list: ProjectContainer[] = [];
  if (deployment.containers) {
    if (typeof deployment.containers === 'string') {
      try {
        list = JSON.parse(deployment.containers);
      } catch {
        list = [];
      }
    } else if (Array.isArray(deployment.containers)) {
      list = deployment.containers;
    }
  }

  // If containers array is empty but legacy internalPort or containerName exists
  if (list.length === 0 && (deployment.internalPort || deployment.containerName)) {
    list = [
      {
        id: 'c_legacy_1',
        name: deployment.serviceName || deployment.containerName || 'default',
        type: 'api',
        containerName: deployment.containerName || null,
        port: deployment.internalPort ? Number(deployment.internalPort) : null,
        portType: 'http',
        isPublic: true,
      },
    ];
  }

  return list;
}

/**
 * Extracts all non-null ports from a container list
 */
export function extractPorts(containers: ProjectContainer[]): Array<{
  port: number;
  name: string;
  type: ContainerServiceType;
  portType: PortProtocolType;
}> {
  return containers
    .filter((c) => typeof c.port === 'number' && !isNaN(c.port) && c.port > 0)
    .map((c) => ({
      port: Number(c.port),
      name: c.name || 'service',
      type: c.type || 'other',
      portType: c.portType || 'http',
    }));
}
