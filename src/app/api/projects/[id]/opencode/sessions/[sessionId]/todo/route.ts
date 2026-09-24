import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, hosts } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { getOpenCodeSessionTodo, OpenCodeHostConfig } from '@/lib/opencode';
import { eq } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId, sessionId } = await params;
  if (!auth.isAdmin && !isProjectAllowed(auth, projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || !project.hostId) {
    return NextResponse.json({ todos: [] });
  }

  const [host] = await db.select().from(hosts).where(eq(hosts.id, project.hostId)).limit(1);
  if (!host || !host.opencodeEnabled) {
    return NextResponse.json({ todos: [] });
  }

  try {
    const todos = await getOpenCodeSessionTodo(host as OpenCodeHostConfig, sessionId);
    return NextResponse.json({ success: true, todos });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, todos: [] }, { status: 500 });
  }
}
