import { createClient } from '@libsql/client';
import path from 'path';

const client = createClient({
  url: `file:${path.join(process.cwd(), 'data', 'visor.db')}`,
});

function normalizeContainers(deployment) {
  if (!deployment) return [];
  let list = [];
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

  if (list.length === 0 && (deployment.internal_port || deployment.container_name || deployment.internalPort || deployment.containerName)) {
    const port = deployment.internal_port || deployment.internalPort;
    const cName = deployment.container_name || deployment.containerName;
    list = [
      {
        id: 'c_legacy_1',
        name: deployment.service_name || deployment.serviceName || cName || 'default',
        type: 'api',
        containerName: cName || null,
        port: port ? Number(port) : null,
        portType: 'http',
        isPublic: true,
      },
    ];
  }

  return list;
}

function extractPorts(containers) {
  return containers
    .filter((c) => typeof c.port === 'number' && !isNaN(c.port) && c.port > 0)
    .map((c) => ({
      port: Number(c.port),
      name: c.name || 'service',
      type: c.type || 'other',
      portType: c.portType || 'http',
    }));
}

async function runTests() {
  console.log('🧪 Starting Multi-Containers & Ports Verification Suite...\n');

  // Test 1: Helper Normalization & Types
  console.log('--- Test 1: Helper Normalization & Protocols ---');
  const legacyDep = {
    runtimeType: 'docker_compose',
    internalPort: 8080,
    containerName: 'legacy_app_1',
    serviceName: 'legacy_app',
  };
  const normalizedLegacy = normalizeContainers(legacyDep);
  if (normalizedLegacy.length !== 1 || normalizedLegacy[0].port !== 8080) {
    throw new Error(`Legacy normalization failed: ${JSON.stringify(normalizedLegacy)}`);
  }
  console.log('✓ Legacy deployment normalized to 1 container with port 8080');

  const multiContainersJson = JSON.stringify([
    { id: 'c_1', name: 'web', type: 'web', port: 3000, portType: 'http', containerName: 'prod_web' },
    { id: 'c_2', name: 'api', type: 'api', port: 8000, portType: 'http', containerName: 'prod_api' },
    { id: 'c_3', name: 'postgres', type: 'database', port: 5432, portType: 'tcp', containerName: 'prod_pg' },
    { id: 'c_4', name: 'redis', type: 'cache', port: 6379, portType: 'tcp', containerName: 'prod_redis' },
    { id: 'c_5', name: 'worker', type: 'worker', port: null, containerName: 'prod_worker' },
  ]);

  const parsed = normalizeContainers({ containers: multiContainersJson });
  if (parsed.length !== 5) {
    throw new Error(`Expected 5 containers, got ${parsed.length}`);
  }
  const ports = extractPorts(parsed);
  if (ports.length !== 4) {
    throw new Error(`Expected 4 ports extracted, got ${ports.length}`);
  }
  console.log(`✓ 5 containers parsed (${ports.length} with ports: ${ports.map((p) => `${p.name}:${p.port} [${p.type}]`).join(', ')})`);

  // Ensure containers column exists in DB
  try {
    await client.execute("ALTER TABLE deployments ADD COLUMN containers TEXT DEFAULT '[]';");
  } catch {
    // already exists
  }

  // Test 2: Database Schema & Migration
  console.log('\n--- Test 2: Database Insert & Persistence ---');
  const testHostId = `host_test_mc_${Date.now()}`;
  await client.execute({
    sql: `INSERT INTO hosts (id, name, ip_address, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [testHostId, 'Test MultiContainer Host', '192.168.10.50', 'online', Date.now(), Date.now()],
  });

  const testProjId = `proj_test_mc_${Date.now()}`;
  await client.execute({
    sql: `INSERT INTO projects (id, slug, title, status, host_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [testProjId, `mc-proj-${Date.now()}`, 'Multi Container SaaS', 'in_dev', testHostId, Date.now(), Date.now()],
  });

  const testDepId = `dep_test_mc_${Date.now()}`;
  await client.execute({
    sql: `INSERT INTO deployments (id, project_id, runtime_type, internal_port, container_name, containers, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [testDepId, testProjId, 'docker_compose', 3000, 'prod_web', multiContainersJson, Date.now()],
  });

  const [dbDep] = (await client.execute({
    sql: 'SELECT * FROM deployments WHERE id = ?',
    args: [testDepId],
  })).rows;

  if (!dbDep || !dbDep.containers) {
    throw new Error('Failed to retrieve deployment with containers column');
  }

  const loadedContainers = JSON.parse(dbDep.containers);
  if (loadedContainers.length !== 5) {
    throw new Error(`Expected 5 containers from DB, got ${loadedContainers.length}`);
  }
  console.log('✓ Successfully stored and retrieved 5 containers in DB with types and ports');

  // Test 3: Multi-Port Conflict Detection
  console.log('\n--- Test 3: Host Port Conflict Detection Across Containers ---');
  // Add a second project on the same host that also occupies port 5432 (postgres conflict!)
  const testProj2Id = `proj_test_conflict_${Date.now()}`;
  await client.execute({
    sql: `INSERT INTO projects (id, slug, title, status, host_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [testProj2Id, `conflict-proj-${Date.now()}`, 'CRM with Shared PG', 'in_dev', testHostId, Date.now(), Date.now()],
  });

  const conflictContainersJson = JSON.stringify([
    { id: 'c_crm_db', name: 'crm-db', type: 'database', port: 5432, portType: 'tcp' },
    { id: 'c_crm_api', name: 'crm-api', type: 'api', port: 8081, portType: 'http' },
  ]);

  const testDep2Id = `dep_test_conflict_${Date.now()}`;
  await client.execute({
    sql: `INSERT INTO deployments (id, project_id, runtime_type, internal_port, container_name, containers, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [testDep2Id, testProj2Id, 'docker_compose', 8081, 'crm_api', conflictContainersJson, Date.now()],
  });

  // Calculate conflict
  const allHostDeployments = (await client.execute({
    sql: `SELECT d.* FROM deployments d JOIN projects p ON d.project_id = p.id WHERE p.host_id = ?`,
    args: [testHostId],
  })).rows;

  const allCollectedPorts = [];
  for (const dep of allHostDeployments) {
    const cList = normalizeContainers(dep);
    const pList = extractPorts(cList);
    allCollectedPorts.push(...pList.map((p) => p.port));
  }

  const dupes = allCollectedPorts.filter((item, idx) => allCollectedPorts.indexOf(item) !== idx);
  if (!dupes.includes(5432)) {
    throw new Error(`Expected port 5432 conflict to be detected, found: ${dupes.join(', ')}`);
  }
  console.log(`✓ Port conflict correctly detected on port 5432 between SaaS Postgres and CRM Postgres!`);

  // Clean up test records
  await client.execute({ sql: 'DELETE FROM deployments WHERE id IN (?, ?)', args: [testDepId, testDep2Id] });
  await client.execute({ sql: 'DELETE FROM projects WHERE id IN (?, ?)', args: [testProjId, testProj2Id] });
  await client.execute({ sql: 'DELETE FROM hosts WHERE id = ?', args: [testHostId] });
  console.log('✓ Cleaned up temporary test data');

  console.log('\n========================================');
  console.log('🎉 ALL MULTI-CONTAINER TESTS PASSED 100%!');
  console.log('========================================\n');
}

runTests().catch((err) => {
  console.error('❌ Multi-Container Test Failed:', err);
  process.exit(1);
});
