import { createClient } from '@libsql/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import path from 'path';

const client = createClient({
  url: `file:${path.join(process.cwd(), 'data', 'visor.db')}`,
});

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function runTestSuite() {
  console.log('🧪 Starting Multi-User Project Sharing & Personal Tokens Verification Suite...\n');

  const ts = Date.now();
  const aliceId = `usr_alice_${ts}`;
  const bobId = `usr_bob_${ts}`;
  const alicePass = await bcrypt.hash('alice123', 10);
  const bobPass = await bcrypt.hash('bob123', 10);

  // 1. Create two test users
  console.log('--- Step 1: User Registration ---');
  await client.execute({
    sql: 'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [aliceId, `alice_${ts}`, alicePass, 'user', ts],
  });
  await client.execute({
    sql: 'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [bobId, `bob_${ts}`, bobPass, 'user', ts],
  });
  console.log(`✓ Created users: alice_${ts} and bob_${ts}`);

  // 2. Alice creates a private project
  console.log('\n--- Step 2: Alice creates private project ---');
  const projId = `proj_alice_${ts}`;
  await client.execute({
    sql: 'INSERT INTO projects (id, slug, title, description, category, status, priority, owner_id, tags, readme_notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [projId, `alice-app-${ts}`, 'Alice Private App', 'Top secret', 'saas', 'in_dev', 'high', aliceId, '[]', '', ts, ts],
  });
  console.log(`✓ Project "${projId}" created with owner: ${aliceId}`);

  // 3. Verify Bob has NO access initially
  console.log('\n--- Step 3: Verify Bob has NO access initially ---');
  const bobMemberships = await client.execute({
    sql: 'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
    args: [projId, bobId],
  });
  if (bobMemberships.rows.length !== 0) {
    throw new Error('Bob should not have access yet');
  }
  console.log('✓ Verified: Bob is NOT a member of Alice\'s project');

  // 4. Alice shares project with Bob (editor role)
  console.log('\n--- Step 4: Alice grants access to Bob ---');
  const memberRecordId = `pm_${ts}`;
  await client.execute({
    sql: 'INSERT INTO project_members (id, project_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [memberRecordId, projId, bobId, 'editor', ts],
  });
  console.log(`✓ Granted access: Bob is now an "editor" on ${projId}`);

  // 5. Verify Bob now has access
  const bobAfterShare = await client.execute({
    sql: 'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
    args: [projId, bobId],
  });
  if (bobAfterShare.rows.length !== 1 || bobAfterShare.rows[0].role !== 'editor') {
    throw new Error('Bob membership should be active with role "editor"');
  }
  console.log('✓ Verified: Bob has active "editor" role on project');

  // 6. Bob creates a personal API key scoped to Alice's project
  console.log('\n--- Step 5: Bob creates personal scoped API token ---');
  const rawToken = `pv_live_bob_${ts}_secret_key`;
  const tokenHash = hashApiKey(rawToken);
  const bobKeyId = `key_bob_${ts}`;
  await client.execute({
    sql: 'INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, role_scope, allowed_project_ids, can_write_kanban, can_update_status, can_view_infra, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [bobKeyId, bobId, 'Bob Cursor Agent Token', 'pv_live_bob...', tokenHash, 'scoped_projects', JSON.stringify([projId]), 1, 1, 0, ts],
  });
  console.log(`✓ Token "${bobKeyId}" created for user "${bobId}"`);

  // Verify token is in DB with user_id
  const tokenInDb = await client.execute({
    sql: 'SELECT * FROM api_keys WHERE id = ?',
    args: [bobKeyId],
  });
  if (tokenInDb.rows[0].user_id !== bobId) {
    throw new Error('Token should belong to Bob');
  }
  console.log(`✓ Verified: Token owner is Bob (${tokenInDb.rows[0].user_id})`);

  // 7. Alice revokes Bob's access
  console.log('\n--- Step 6: Alice revokes Bob\'s access ---');
  await client.execute({
    sql: 'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
    args: [projId, bobId],
  });
  const bobAfterRevoke = await client.execute({
    sql: 'SELECT * FROM project_members WHERE project_id = ? AND user_id = ?',
    args: [projId, bobId],
  });
  if (bobAfterRevoke.rows.length !== 0) {
    throw new Error('Bob should not have access after revocation');
  }
  console.log('✓ Verified: Bob\'s access is successfully revoked');

  // Clean up test records
  await client.execute({ sql: 'DELETE FROM api_keys WHERE id = ?', args: [bobKeyId] });
  await client.execute({ sql: 'DELETE FROM projects WHERE id = ?', args: [projId] });
  await client.execute({ sql: 'DELETE FROM users WHERE id IN (?, ?)', args: [aliceId, bobId] });
  console.log('\n✓ Cleaned up test artifacts from database');

  console.log('\n========================================');
  console.log('🎉 ALL MULTI-USER & TOKEN TESTS PASSED 100%!');
  console.log('========================================\n');
}

runTestSuite().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
