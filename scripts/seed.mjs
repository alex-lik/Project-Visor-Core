import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const client = createClient({
  url: `file:${path.join(dataDir, 'visor.db')}`,
});

async function main() {
  // СТРАХОВКА: сид никогда не должен затирать/создавать данные в проде случайно.
  // В production требуем явный флаг, иначе выходим без действий.
  const forceFlag = process.argv.includes('--force') || process.env.ALLOW_SEED === '1';
  if (process.env.NODE_ENV === 'production' && !forceFlag) {
    console.log('⛔ seed пропущен: NODE_ENV=production без --force / ALLOW_SEED=1. База не тронута.');
    return;
  }

  console.log('⚡ Initializing Project Visor SQLite database...');

  // Create tables
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      email TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hosts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ip_address TEXT,
      ssh_alias TEXT,
      ssh_user TEXT DEFAULT 'root',
      ssh_port INTEGER DEFAULT 22,
      provider TEXT,
      os_type TEXT DEFAULT 'Ubuntu 24.04',
      specs TEXT,
      prometheus_job TEXT,
      status TEXT DEFAULT 'online',
      notes TEXT,
      opencode_enabled INTEGER DEFAULT 0,
      opencode_host TEXT,
      opencode_port INTEGER DEFAULT 4096,
      opencode_use_https INTEGER DEFAULT 0,
      opencode_username TEXT DEFAULT 'opencode',
      opencode_password TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'website',
      status TEXT NOT NULL DEFAULT 'idea',
      priority TEXT NOT NULL DEFAULT 'medium',
      repo_url TEXT,
      public_url TEXT,
      doc_url TEXT,
      host_id TEXT REFERENCES hosts(id),
      owner_id TEXT REFERENCES users(id),
      tags TEXT DEFAULT '[]',
      readme_notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      runtime_type TEXT NOT NULL DEFAULT 'docker_compose',
      deploy_automation TEXT NOT NULL DEFAULT 'manual_ssh',
      internal_port INTEGER,
      container_name TEXT,
      service_name TEXT,
      containers TEXT DEFAULT '[]',
      deploy_path TEXT,
      deploy_command TEXT,
      health_endpoint TEXT,
      env_keys_hint TEXT,
      secrets_type TEXT DEFAULT 'dotenv',
      secrets_path_or_uri TEXT,
      notes TEXT,
      backup_enabled INTEGER DEFAULT 0,
      backup_schedule TEXT,
      backup_tool TEXT,
      backup_destination TEXT,
      last_backup_status TEXT,
      last_backup_at INTEGER,
      storage_provider TEXT,
      storage_bucket TEXT,
      storage_endpoint TEXT,
      ftp_host TEXT,
      ftp_port INTEGER DEFAULT 22,
      ftp_user TEXT,
      ftp_path TEXT,
      sentry_project TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_relations (
      id TEXT PRIMARY KEY,
      source_project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      target_project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      relation_type TEXT NOT NULL DEFAULT 'depends_on',
      description TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kanban_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      column TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      position INTEGER NOT NULL DEFAULT 0,
      tags TEXT DEFAULT '[]',
      due_date INTEGER,
      last_run_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS metric_targets (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      host_id TEXT REFERENCES hosts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      check_type TEXT NOT NULL DEFAULT 'http_ping',
      target TEXT NOT NULL,
      last_status TEXT DEFAULT 'unknown',
      last_response_time_ms INTEGER,
      last_value TEXT,
      last_checked_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'editor',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      role_scope TEXT NOT NULL DEFAULT 'all_projects',
      allowed_project_ids TEXT NOT NULL DEFAULT '[]',
      can_write_kanban INTEGER NOT NULL DEFAULT 1,
      can_update_status INTEGER NOT NULL DEFAULT 1,
      can_view_infra INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      expires_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      actor_type TEXT NOT NULL DEFAULT 'user',
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      project_id TEXT,
      details TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS opencode_runs (
      id TEXT PRIMARY KEY,
      host_id TEXT NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      session_id TEXT,
      title TEXT,
      prompt TEXT NOT NULL,
      response TEXT,
      diff TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `);

  console.log('✅ Tables created or verified.');

  const now = Date.now();

  // Create or verify default Admin user
  const adminCheck = await client.execute({
    sql: 'SELECT id FROM users WHERE username = ?',
    args: ['admin'],
  });

  if (adminCheck.rows.length === 0) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await client.execute({
      sql: 'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      args: ['usr_admin', 'admin', passwordHash, 'admin', now],
    });
    console.log('👤 Admin user created: login "admin", password "admin123"');
  }

  // Check if sample data exists and explicit demo flag is provided
  const countCheck = await client.execute('SELECT COUNT(*) as cnt FROM projects');
  const count = countCheck.rows[0].cnt;
  const demoFlag = process.argv.includes('--demo-data') || process.argv.includes('--mock');

  if (Number(count) === 0 && demoFlag) {
    console.log('🌱 Seeding initial infrastructure, projects, and relationships (--demo-data enabled)...');

    // Hosts
    await client.execute({
      sql: `INSERT INTO hosts (id, name, ip_address, ssh_alias, ssh_user, ssh_port, provider, os_type, specs, prometheus_job, status, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'host_hetzner_1',
        'VPS-1 Production (Hetzner)',
        '95.217.14.82',
        'hetzner-main',
        'root',
        22,
        'Hetzner Cloud',
        'Ubuntu 24.04 LTS',
        '4 vCPU / 8 GB RAM / 80 GB NVMe',
        'node_vps1',
        'online',
        'Основной боевой сервер для ботов и API. Docker Swarm / Compose.',
        now,
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO hosts (id, name, ip_address, ssh_alias, ssh_user, ssh_port, provider, os_type, specs, prometheus_job, status, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'host_home_lab',
        'Home Lab Dev Server',
        '192.168.1.100',
        'home-srv',
        'alex',
        2222,
        'Local Hardware',
        'Debian 12 Bookworm',
        '8 Core i7 / 32 GB RAM / 1 TB SSD',
        'node_homelab',
        'online',
        'Домашний сервер под разработку, тяжелые скрипты парсинга и тесты.',
        now,
        now,
      ],
    });

    // Projects
    await client.execute({
      sql: `INSERT INTO projects (id, slug, title, description, category, status, priority, repo_url, public_url, host_id, tags, readme_notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'proj_crm',
        'core-business-crm',
        'Core Business CRM',
        'Основная CRM-система для учета клиентов, заказов и воронки продаж.',
        'crm',
        'production',
        'critical',
        'https://github.com/my-org/core-crm',
        'https://crm.mycompany.com',
        'host_hetzner_1',
        JSON.stringify(['nextjs', 'fastapi', 'postgresql', 'tailwind']),
        '### Архитектура CRM\n- API бэкенд на FastAPI\n- Фронтенд на Next.js\n- БД PostgreSQL в отдельном контейнере',
        now,
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO projects (id, slug, title, description, category, status, priority, repo_url, public_url, host_id, tags, readme_notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'proj_tg_bot',
        'telegram-sales-bot',
        'Telegram Sales & Support Bot',
        'Бот для приема заявок от клиентов в Telegram, рассылки уведомлений и техподдержки.',
        'bot',
        'production',
        'high',
        'https://github.com/my-org/tg-sales-bot',
        'https://t.me/MyAwesomeSalesBot',
        'host_hetzner_1',
        JSON.stringify(['python', 'aiogram3', 'redis', 'docker']),
        '### Настройки бота\nWebhook настроен через Nginx reverse proxy на порт 8080.',
        now,
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO projects (id, slug, title, description, category, status, priority, repo_url, public_url, host_id, tags, readme_notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'proj_parser',
        'market-lead-parser',
        'Market Lead Parser Script',
        'Автоматизированный скрипт сбора и обогащения контактов потенциальных клиентов.',
        'script',
        'in_dev',
        'medium',
        'https://github.com/my-org/lead-parser',
        null,
        'host_home_lab',
        JSON.stringify(['python', 'playwright', 'celery', 'pm2']),
        'Запускается по крону каждые 6 часов. Результаты пушатся в Core CRM по API.',
        now,
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO projects (id, slug, title, description, category, status, priority, repo_url, public_url, host_id, tags, readme_notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'proj_landing',
        'saas-landing-website',
        'SaaS Promo & Landing Page',
        'Главный лендинг с описанием услуг, формой регистрации и SEO-оптимизацией.',
        'website',
        'staging',
        'high',
        'https://github.com/my-org/landing-site',
        'https://staging.mycompany.com',
        null,
        JSON.stringify(['astro', 'react', 'tailwind', 'cloudflare']),
        'Хостинг в Cloudflare Pages. Автоматический деплой из ветки staging.',
        now,
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO projects (id, slug, title, description, category, status, priority, repo_url, public_url, host_id, tags, readme_notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'proj_ai_agent',
        'ai-voice-concierge',
        'AI Voice Concierge Bot',
        'Идея голосового ассистента для автоматического ответа на входящие звонки клиентов.',
        'idea',
        'idea',
        'medium',
        null,
        null,
        null,
        JSON.stringify(['ai', 'whisper', 'elevenlabs', 'webrtc']),
        '### Концепция\nИнтеграция с SIP телефонией и транскрибация звонков на лету.',
        now,
        now,
      ],
    });

    // Deployments
    await client.execute({
      sql: `INSERT INTO deployments (id, project_id, runtime_type, deploy_automation, internal_port, container_name, service_name, deploy_path, deploy_command, health_endpoint, env_keys_hint, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'dep_crm',
        'proj_crm',
        'docker_compose',
        'github_actions',
        3000,
        'crm_frontend_app',
        'docker-compose-crm',
        '/opt/services/core-crm',
        'docker compose pull && docker compose up -d --remove-orphans',
        '/api/health',
        'DATABASE_URL, SECRET_KEY, REDIS_URL',
        'Nginx проксирует с порта 443 на localhost:3000',
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO deployments (id, project_id, runtime_type, deploy_automation, internal_port, container_name, service_name, deploy_path, deploy_command, health_endpoint, env_keys_hint, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'dep_tg_bot',
        'proj_tg_bot',
        'docker_standalone',
        'webhook',
        8080,
        'telegram_sales_bot',
        'tg-bot.service',
        '/opt/bots/sales-bot',
        'docker restart telegram_sales_bot',
        '/webhook/health',
        'TELEGRAM_BOT_TOKEN, CRM_API_KEY, CRM_BASE_URL',
        'Порт 8080 для приема входящих вебхуков от Telegram API',
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO deployments (id, project_id, runtime_type, deploy_automation, internal_port, container_name, service_name, deploy_path, deploy_command, health_endpoint, env_keys_hint, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'dep_parser',
        'proj_parser',
        'pm2',
        'manual_ssh',
        null,
        null,
        'lead-parser-cron',
        '/home/alex/workers/lead-parser',
        'pm2 restart lead-parser',
        null,
        'PARSER_PROXY_LIST, CRM_API_SECRET',
        'Запущен в PM2 с флагом autorestart',
        now,
      ],
    });

    // Project relations
    await client.execute({
      sql: `INSERT INTO project_relations (id, source_project_id, target_project_id, relation_type, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        'rel_1',
        'proj_tg_bot',
        'proj_crm',
        'api_calls',
        'Бот создает лиды и проверяет статус заказов через REST API CRM',
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO project_relations (id, source_project_id, target_project_id, relation_type, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        'rel_2',
        'proj_parser',
        'proj_crm',
        'webhook_events',
        'Парсер пушит найденные компании напрямую в базу CRM',
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO project_relations (id, source_project_id, target_project_id, relation_type, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        'rel_3',
        'proj_landing',
        'proj_crm',
        'api_calls',
        'Форма заявки с лендинга отправляет POST запрос в CRM',
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO project_relations (id, source_project_id, target_project_id, relation_type, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        'rel_4',
        'proj_ai_agent',
        'proj_crm',
        'depends_on',
        'Голосовой агент будет синхронизировать звонки с карточками клиентов в CRM',
        now,
      ],
    });

    // Kanban tasks
    const tasks = [
      {
        id: 'task_1',
        projectId: 'proj_crm',
        title: 'Рефакторинг экспорта отчетов в Excel',
        description: 'Оптимизировать генерацию xlsx файлов для выгрузок более 50 000 строк через стриминг.',
        column: 'in_progress',
        priority: 'high',
        tags: ['backend', 'performance'],
      },
      {
        id: 'task_2',
        projectId: 'proj_crm',
        title: 'Добавить фильтр клиентов по тегам',
        description: 'В таблице клиентов реализовать multi-select фильтр по назначенным тегам.',
        column: 'todo',
        priority: 'medium',
        tags: ['frontend', 'ui'],
      },
      {
        id: 'task_3',
        projectId: 'proj_tg_bot',
        title: 'Сделать поддержку медиа-групп в чате с оператором',
        description: 'Если клиент шлет несколько фото подряд, группировать их в одно обращение.',
        column: 'in_progress',
        priority: 'urgent',
        tags: ['bot', 'feature'],
      },
      {
        id: 'task_4',
        projectId: 'proj_parser',
        title: 'Ротация прокси при 429 Too Many Requests',
        description: 'Добавить пул мобильных прокси и автопереключение при блокировках.',
        column: 'backlog',
        priority: 'high',
        tags: ['parser', 'infra'],
      },
      {
        id: 'task_5',
        projectId: 'proj_landing',
        title: 'Обновить блок с тарифами и ценами',
        description: 'Переписать карточки тарифов под новую модель подписки.',
        column: 'review',
        priority: 'medium',
        tags: ['copywriting', 'ui'],
      },
      {
        id: 'task_6',
        projectId: 'proj_ai_agent',
        title: 'Протестировать задержку ElevenLabs WebSockets',
        description: 'Замерить время ответа синтеза речи при стриминге чанков.',
        column: 'backlog',
        priority: 'medium',
        tags: ['research', 'ai'],
      },
      {
        id: 'task_7',
        projectId: 'proj_crm',
        title: 'Настроить ежедневный бэкап Postgres в S3',
        description: 'Скрипт pg_dumpall с шифрованием gpg и загрузкой в Yandex Object Storage.',
        column: 'done',
        priority: 'critical',
        tags: ['devops', 'security'],
      },
    ];

    for (const t of tasks) {
      await client.execute({
        sql: `INSERT INTO kanban_tasks (id, project_id, title, description, column, priority, position, tags, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          t.id,
          t.projectId,
          t.title,
          t.description,
          t.column,
          t.priority,
          0,
          JSON.stringify(t.tags),
          now,
          now,
        ],
      });
    }

    // Health / Metric targets
    await client.execute({
      sql: `INSERT INTO metric_targets (id, project_id, host_id, name, check_type, target, last_status, last_response_time_ms, last_value, last_checked_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'mt_crm_health',
        'proj_crm',
        'host_hetzner_1',
        'CRM API Health Endpoint',
        'http_ping',
        'https://httpbin.org/status/200',
        'healthy',
        42,
        'HTTP 200 OK',
        now,
        now,
      ],
    });

    await client.execute({
      sql: `INSERT INTO metric_targets (id, project_id, host_id, name, check_type, target, last_status, last_response_time_ms, last_value, last_checked_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'mt_hetzner_cpu',
        null,
        'host_hetzner_1',
        'VPS-1 CPU Load (Prometheus)',
        'prometheus_query',
        '100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
        'healthy',
        18,
        '14.2% CPU',
        now,
        now,
      ],
    });

    // Default MCP Agent API Key
    const demoRawKey = 'pv_live_antigravity_master_demo_key_9981';
    const demoPrefix = 'pv_live_anti...';
    const demoHash = crypto.createHash('sha256').update(demoRawKey).digest('hex');

    await client.execute({
      sql: `INSERT INTO api_keys (id, name, key_prefix, key_hash, role_scope, allowed_project_ids, can_write_kanban, can_update_status, can_view_infra, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'key_master_agent',
        'Antigravity & Claude Master Agent Key',
        demoPrefix,
        demoHash,
        'all_projects',
        '[]',
        1,
        1,
        1,
        now,
      ],
    });

    console.log('🔑 Master Agent API Key seeded:');
    console.log(`   Token: ${demoRawKey}`);

    // Initial activity log
    await client.execute({
      sql: `INSERT INTO activity_logs (id, actor_type, actor_name, action, project_id, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'act_init',
        'system',
        'System Installer',
        'system_init',
        null,
        'Система Project Visor успешно инициализирована. База данных готова к работе.',
        now,
      ],
    });

    console.log('🎉 Sample data successfully seeded!');
  }
}

main().catch((err) => {
  console.error('❌ Database initialization error:', err);
  process.exit(1);
});
