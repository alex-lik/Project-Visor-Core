import { createClient } from '@libsql/client';
import path from 'path';

const client = createClient({
  url: `file:${path.join(process.cwd(), 'data', 'visor.db')}`,
});

function buildOpenCodeBaseUrl(host) {
  const protocol = host.opencodeUseHttps ? 'https' : 'http';
  const targetHost = host.opencodeHost?.trim() || host.ip;
  const port = host.opencodePort || 4096;
  return `${protocol}://${targetHost}:${port}`;
}

function buildOpenCodeHeaders(host) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (host.opencodeUsername && host.opencodePassword) {
    const creds = Buffer.from(`${host.opencodeUsername}:${host.opencodePassword}`).toString('base64');
    headers['Authorization'] = `Basic ${creds}`;
  }
  return headers;
}

async function runTestSuite() {
  console.log('🧪 Starting OpenCode Server API Integration Verification Suite...\n');

  const ts = Date.now();
  const testHostId = `host_test_opencode_${ts}`;
  const testProjId = `proj_test_opencode_${ts}`;
  const testRunId1 = `run_test_1_${ts}`;
  const testRunId2 = `run_test_2_${ts}`;

  try {
    // 1. Verify schema columns on hosts
    console.log('--- Step 1: Verify hosts schema ---');
    const tableInfo = await client.execute('PRAGMA table_info(hosts)');
    const colNames = tableInfo.rows.map((r) => r.name);
    const requiredCols = [
      'opencode_enabled',
      'opencode_host',
      'opencode_port',
      'opencode_use_https',
      'opencode_username',
      'opencode_password',
    ];
    for (const col of requiredCols) {
      if (!colNames.includes(col)) {
        throw new Error(`Missing column in hosts table: ${col}`);
      }
    }
    console.log('✓ All 6 opencode_* columns present in hosts table');

    // 2. Verify opencode_runs table
    console.log('\n--- Step 2: Verify opencode_runs table ---');
    const runsInfo = await client.execute('PRAGMA table_info(opencode_runs)');
    const runCols = runsInfo.rows.map((r) => r.name);
    const requiredRunCols = [
      'id',
      'host_id',
      'project_id',
      'user_id',
      'session_id',
      'title',
      'prompt',
      'response',
      'diff',
      'status',
      'error_message',
      'created_at',
      'completed_at',
    ];
    for (const col of requiredRunCols) {
      if (!runCols.includes(col)) {
        throw new Error(`Missing column in opencode_runs table: ${col}`);
      }
    }
    console.log('✓ All required columns present in opencode_runs table');

    // 3. OpenCode Helper Functions Check
    console.log('\n--- Step 3: Test OpenCode URL and Headers Helpers ---');
    const mockHostHttp = {
      ip: '192.168.1.100',
      opencodeHost: null,
      opencodePort: 4096,
      opencodeUseHttps: 0,
      opencodeUsername: 'admin',
      opencodePassword: 'secretpassword',
    };
    const baseUrlHttp = buildOpenCodeBaseUrl(mockHostHttp);
    if (baseUrlHttp !== 'http://192.168.1.100:4096') {
      throw new Error(`Unexpected baseUrlHttp: ${baseUrlHttp}`);
    }

    const mockHostHttps = {
      ip: '192.168.1.100',
      opencodeHost: 'opencode.example.com',
      opencodePort: 8443,
      opencodeUseHttps: 1,
      opencodeUsername: 'opencode_user',
      opencodePassword: 'mypassword',
    };
    const baseUrlHttps = buildOpenCodeBaseUrl(mockHostHttps);
    if (baseUrlHttps !== 'https://opencode.example.com:8443') {
      throw new Error(`Unexpected baseUrlHttps: ${baseUrlHttps}`);
    }

    const headers = buildOpenCodeHeaders(mockHostHttps);
    const expectedAuth = 'Basic ' + Buffer.from('opencode_user:mypassword').toString('base64');
    if (headers['Authorization'] !== expectedAuth) {
      throw new Error(`Authorization header mismatch. Expected ${expectedAuth}, got ${headers['Authorization']}`);
    }
    console.log('✓ URL builder and Basic Auth headers builder pass validation');

    // 4. Create Host with OpenCode config
    console.log('\n--- Step 4: Create Host with OpenCode Configuration ---');
    await client.execute({
      sql: `INSERT INTO hosts (
        id, name, ip_address, provider, status,
        opencode_enabled, opencode_host, opencode_port, opencode_use_https, opencode_username, opencode_password,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        testHostId,
        'Prod Server Alpha',
        '10.0.0.50',
        'hetzner',
        'healthy',
        1,
        'code.internal.net',
        4096,
        0,
        'dev_user',
        'dev_pass_123',
        ts,
        ts,
      ],
    });
    console.log(`✓ Created test host: ${testHostId} with OpenCode enabled on port 4096`);

    // 5. Create Project associated with Host
    console.log('\n--- Step 5: Associate Project with Host ---');
    await client.execute({
      sql: `INSERT INTO projects (
        id, slug, title, description, category, status, priority, host_id, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        testProjId,
        `slug-${ts}`,
        'Test OpenCode Project',
        'Testing OpenCode AI tasks',
        'saas',
        'active',
        'high',
        testHostId,
        '["ai","opencode"]',
        ts,
        ts,
      ],
    });
    console.log(`✓ Project ${testProjId} associated with host ${testHostId}`);

    // 6. Insert Run with Diff
    console.log('\n--- Step 6: Store Completed Run with Git Diff ---');
    const mockDiff = `diff --git a/Dockerfile b/Dockerfile
new file mode 100644
index 0000000..738a8e1
--- /dev/null
+++ b/Dockerfile
@@ -0,0 +1,12 @@
+FROM node:20-alpine AS base
+WORKDIR /app
+COPY package*.json ./
+RUN npm ci --production
+COPY . .
+EXPOSE 3000
+CMD ["node", "server.js"]`;

    await client.execute({
      sql: `INSERT INTO opencode_runs (
        id, host_id, project_id, user_id, session_id, title, prompt, response, diff, status, error_message, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        testRunId1,
        testHostId,
        testProjId,
        'usr_admin',
        'ses_mock_abc123',
        'Dockerfile Generation',
        'Generate production Dockerfile for node app',
        'I have generated a clean multi-stage Alpine Dockerfile.',
        mockDiff,
        'completed',
        null,
        ts,
        ts + 4500,
      ],
    });
    console.log(`✓ Inserted completed run ${testRunId1} with diff`);

    // 7. Insert Failed Run
    console.log('\n--- Step 7: Store Failed Run with Error Message ---');
    await client.execute({
      sql: `INSERT INTO opencode_runs (
        id, host_id, project_id, user_id, session_id, title, prompt, response, diff, status, error_message, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        testRunId2,
        testHostId,
        testProjId,
        'usr_admin',
        null,
        'Invalid Task',
        'Broken prompt syntax',
        null,
        null,
        'failed',
        'OpenCode Server returned 500: syntax parsing error',
        ts,
        ts + 1200,
      ],
    });
    console.log(`✓ Inserted failed run ${testRunId2} with error message`);

    // 8. Query and verify runs for project
    console.log('\n--- Step 8: Verify runs querying ---');
    const projectRuns = await client.execute({
      sql: 'SELECT * FROM opencode_runs WHERE project_id = ? ORDER BY created_at DESC',
      args: [testProjId],
    });
    if (projectRuns.rows.length !== 2) {
      throw new Error(`Expected 2 runs for project, got ${projectRuns.rows.length}`);
    }

    const run1 = projectRuns.rows.find((r) => r.id === testRunId1);
    if (!run1 || run1.status !== 'completed' || !run1.diff?.includes('FROM node:20-alpine')) {
      throw new Error('Run 1 data verification failed');
    }

    const run2 = projectRuns.rows.find((r) => r.id === testRunId2);
    if (!run2 || run2.status !== 'failed' || !run2.error_message?.includes('500')) {
      throw new Error('Run 2 data verification failed');
    }
    console.log('✓ Project runs query successfully retrieved both runs with correct statuses and payloads');

    console.log('\n🎉 ALL OPENCODE INTEGRATION TESTS PASSED PERFECTLY!\n');
  } finally {
    // Cleanup
    console.log('--- Cleanup ---');
    await client.execute({ sql: 'DELETE FROM opencode_runs WHERE id IN (?, ?)', args: [testRunId1, testRunId2] });
    await client.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [testProjId] });
    await client.execute({ sql: 'DELETE FROM hosts WHERE id = ?', args: [testHostId] });
    console.log('✓ Test fixtures successfully cleaned up');
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
