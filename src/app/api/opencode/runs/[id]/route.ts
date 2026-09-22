import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { opencodeRuns, hosts, projects } from '@/db/schema';
import { authenticateRequest } from '@/lib/rbac';
import { ensureDatabaseInitialized } from '@/db/init';
import { syncOpenCodeRun } from '@/lib/opencode';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDatabaseInitialized();
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [run] = await db.select().from(opencodeRuns).where(eq(opencodeRuns.id, id)).limit(1);

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const [host] = await db.select().from(hosts).where(eq(hosts.id, run.hostId)).limit(1);
  let project = null;
  if (run.projectId) {
    const [p] = await db.select().from(projects).where(eq(projects.id, run.projectId)).limit(1);
    project = p;
  }

  return NextResponse.json({
    ...run,
    hostName: host?.name || 'Unknown',
    projectTitle: project?.title || null,
  });
}

/**
 * POST /api/opencode/runs/:id - Synchronize run with remote OpenCode session
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDatabaseInitialized();
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const result = await syncOpenCodeRun(id);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`[API /api/opencode/runs/${id} POST/sync] Error:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Ошибка синхронизации сессии' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDatabaseInitialized();
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await db.delete(opencodeRuns).where(eq(opencodeRuns.id, id));
  return NextResponse.json({ success: true });
}

