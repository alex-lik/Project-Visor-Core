import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, hosts, activityLogs } from '@/db/schema';
import { authenticateRequest } from '@/lib/rbac';
import { canUserEditProject } from '@/lib/project-access';
import { forkOpenCodeSession, OpenCodeHostConfig } from '@/lib/opencode';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId, sessionId } = await params;
  if (!(await canUserEditProject(auth, projectId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || !project.hostId) {
    return NextResponse.json({ error: 'Project has no host configured' }, { status: 400 });
  }

  const [host] = await db.select().from(hosts).where(eq(hosts.id, project.hostId)).limit(1);
  if (!host || !host.opencodeEnabled) {
    return NextResponse.json({ error: 'OpenCode is disabled on host' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const messageId = typeof body.messageId === 'string' ? body.messageId : undefined;

  try {
    const forked = await forkOpenCodeSession(host as OpenCodeHostConfig, sessionId, messageId);

    await db.insert(activityLogs).values({
      id: nanoid(),
      actorType: 'user',
      actorName: auth.username || 'User',
      action: 'opencode_session_forked',
      projectId,
      details: `Сессия ${sessionId} ответвлена в новую сессию ${forked?.id || 'forked'}`,
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true, session: forked });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
