import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('admin'), // 'admin' | 'viewer'
  email: text('email'),
  createdAt: integer('created_at').notNull(),
});

export const hosts = sqliteTable('hosts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ipAddress: text('ip_address'),
  sshAlias: text('ssh_alias'),
  sshUser: text('ssh_user').default('root'),
  sshPort: integer('ssh_port').default(22),
  provider: text('provider'), // Hetzner, DigitalOcean, Local, AWS, etc.
  osType: text('os_type').default('Ubuntu 24.04'),
  specs: text('specs'), // e.g. "4 vCPU / 8 GB RAM / 100 GB NVMe"
  prometheusJob: text('prometheus_job'),
  status: text('status').default('online'), // 'online' | 'degraded' | 'offline' | 'unknown'
  notes: text('notes'),
  opencodeEnabled: integer('opencode_enabled').default(0),
  opencodeHost: text('opencode_host'),
  opencodePort: integer('opencode_port').default(4096),
  opencodeUseHttps: integer('opencode_use_https').default(0),
  opencodeUsername: text('opencode_username').default('opencode'),
  opencodePassword: text('opencode_password'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull().default('website'), // 'website' | 'bot' | 'crm' | 'script' | 'api' | 'system' | 'idea' | 'mobile' | 'saas'
  status: text('status').notNull().default('idea'), // 'idea' | 'backlog' | 'in_dev' | 'staging' | 'production' | 'paused' | 'archived'
  priority: text('priority').notNull().default('medium'), // 'low' | 'medium' | 'high' | 'critical'
  repoUrl: text('repo_url'),
  publicUrl: text('public_url'),
  docUrl: text('doc_url'),
  hostId: text('host_id').references(() => hosts.id),
  ownerId: text('owner_id').references(() => users.id),
  tags: text('tags').default('[]'), // JSON array of string tags
  readmeNotes: text('readme_notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const deployments = sqliteTable('deployments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  runtimeType: text('runtime_type').notNull().default('docker_compose'), // 'docker_compose' | 'docker_standalone' | 'kubernetes' | 'docker_swarm' | 'coolify_portainer' | 'systemd_service' | 'pm2' | 'cron' | 'manual' | 'serverless'
  deployAutomation: text('deploy_automation').notNull().default('manual_ssh'), // 'github_actions' | 'jenkins' | 'gitlab_ci' | 'argocd' | 'webhook' | 'manual_ssh' | 'local_script'
  internalPort: integer('internal_port'),
  containerName: text('container_name'),
  serviceName: text('service_name'),
  containers: text('containers').default('[]'), // JSON array of ProjectContainer (multiple containers and ports with types)
  deployPath: text('deploy_path'), // e.g. "/opt/services/my-bot"
  deployCommand: text('deploy_command'), // e.g. "docker compose up -d --build"
  healthEndpoint: text('health_endpoint'), // e.g. "/api/health" or "http://localhost:8080"
  envKeysHint: text('env_keys_hint'), // e.g. "BOT_TOKEN, DB_PASSWORD, JWT_SECRET"
  secretsType: text('secrets_type').default('dotenv'), // 'dotenv' | 'vault' | 'k8s_secrets' | 'docker_secrets' | 'doppler_infisical' | 'aws_secrets' | 'cicd_secrets' | 'hardcode'
  secretsPathOrUri: text('secrets_path_or_uri'),
  notes: text('notes'),

  // Backups
  backupEnabled: integer('backup_enabled').default(0),
  backupSchedule: text('backup_schedule'),
  backupTool: text('backup_tool'),
  backupDestination: text('backup_destination'),
  lastBackupStatus: text('last_backup_status'),
  lastBackupAt: integer('last_backup_at'),

  // Storage S3 / R2
  storageProvider: text('storage_provider'),
  storageBucket: text('storage_bucket'),
  storageEndpoint: text('storage_endpoint'),

  // FTP / SFTP
  ftpHost: text('ftp_host'),
  ftpPort: integer('ftp_port').default(22),
  ftpUser: text('ftp_user'),
  ftpPath: text('ftp_path'),

  // Error monitoring (Sentry / GlitchTip)
  sentryProject: text('sentry_project'),

  updatedAt: integer('updated_at').notNull(),
});

export const projectRelations = sqliteTable('project_relations', {
  id: text('id').primaryKey(),
  sourceProjectId: text('source_project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  targetProjectId: text('target_project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  relationType: text('relation_type').notNull().default('depends_on'), // 'depends_on' | 'api_calls' | 'database_shared' | 'webhook_events' | 'auth_provider' | 'submodule'
  description: text('description'),
  createdAt: integer('created_at').notNull(),
});

export const kanbanTasks = sqliteTable('kanban_tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  column: text('column').notNull().default('todo'), // 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked'
  priority: text('priority').notNull().default('medium'), // 'low' | 'medium' | 'high' | 'critical'
  position: integer('position').notNull().default(0),
  tags: text('tags').default('[]'), // JSON array
  dueDate: integer('due_date'),
  lastRunId: text('last_run_id').references(() => opencodeRuns.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const metricTargets = sqliteTable('metric_targets', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  hostId: text('host_id').references(() => hosts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  checkType: text('check_type').notNull().default('http_ping'), // 'http_ping' | 'prometheus_query' | 'tcp_port'
  target: text('target').notNull(),
  lastStatus: text('last_status').default('unknown'), // 'healthy' | 'warning' | 'critical' | 'unknown'
  lastResponseTimeMs: integer('last_response_time_ms'),
  lastValue: text('last_value'),
  lastCheckedAt: integer('last_checked_at'),
  createdAt: integer('created_at').notNull(),
});

export const projectMembers = sqliteTable('project_members', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('editor'), // 'viewer' | 'editor' | 'admin'
  createdAt: integer('created_at').notNull(),
});

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull(),
  roleScope: text('role_scope').notNull().default('all_projects'), // 'all_projects' | 'scoped_projects'
  allowedProjectIds: text('allowed_project_ids').notNull().default('[]'),
  canWriteKanban: integer('can_write_kanban').notNull().default(1),
  canUpdateStatus: integer('can_update_status').notNull().default(1),
  canViewInfra: integer('can_view_infra').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  lastUsedAt: integer('last_used_at'),
  expiresAt: integer('expires_at'),
});

export const activityLogs = sqliteTable('activity_logs', {
  id: text('id').primaryKey(),
  actorType: text('actor_type').notNull().default('user'), // 'user' | 'agent' | 'system'
  actorName: text('actor_name').notNull(),
  action: text('action').notNull(),
  projectId: text('project_id'),
  details: text('details'),
  createdAt: integer('created_at').notNull(),
});

export const opencodeRuns = sqliteTable('opencode_runs', {
  id: text('id').primaryKey(),
  hostId: text('host_id').notNull().references(() => hosts.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
  sessionId: text('session_id'),
  title: text('title'),
  prompt: text('prompt').notNull(),
  response: text('response'),
  diff: text('diff'),
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed'
  errorMessage: text('error_message'),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Host = typeof hosts.$inferSelect;
export type InsertHost = typeof hosts.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type Deployment = typeof deployments.$inferSelect;
export type InsertDeployment = typeof deployments.$inferInsert;
export type ProjectRelation = typeof projectRelations.$inferSelect;
export type InsertProjectRelation = typeof projectRelations.$inferInsert;
export type KanbanTask = typeof kanbanTasks.$inferSelect;
export type InsertKanbanTask = typeof kanbanTasks.$inferInsert;
export type MetricTarget = typeof metricTargets.$inferSelect;
export type InsertMetricTarget = typeof metricTargets.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = typeof projectMembers.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;
export type OpencodeRun = typeof opencodeRuns.$inferSelect;
export type InsertOpencodeRun = typeof opencodeRuns.$inferInsert;

export type { ProjectContainer, ContainerServiceType, PortProtocolType } from '@/lib/containers';
