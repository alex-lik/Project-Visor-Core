import { client } from './index';
import bcrypt from 'bcryptjs';

let initialized = false;

export async function ensureDatabaseInitialized() {
  if (initialized) return;

  try {
    try {
      await client.execute('PRAGMA busy_timeout = 10000;');
      await client.execute('PRAGMA journal_mode = WAL;');
    } catch {
      // ignore
    }

    // Create Core tables if they do not exist
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

    // Ensure default admin user if none exists
    const usersCount = await client.execute('SELECT COUNT(*) as count FROM users');
    if (Number(usersCount.rows[0]?.count || 0) === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await client.execute({
        sql: `INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)`,
        args: ['usr_admin', 'admin', passwordHash, 'admin', Date.now()],
      });
    }

    initialized = true;
  } catch (err) {
    console.error('Core Database initialization failed:', err);
    throw err;
  }
}
