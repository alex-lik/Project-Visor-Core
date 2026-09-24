import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, hosts, deployments, opencodeRuns } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { canUserEditProject } from '@/lib/project-access';
import { listOpenCodeSessions, createOpenCodeSession, getOpenCodeSessionStatuses, OpenCodeHostConfig } from '@/lib/opencode';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/projects/:id/opencode/sessions
 * Returns all OpenCode sessions from the host associated with this project.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;
  if (!auth.isAdmin && !isProjectAllowed(auth, projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (!project.hostId) {
    return NextResponse.json(
      { error: 'Проект не привязан к серверу с OpenCode', sessions: [] },
      { status: 200 }
    );
  }

  const [host] = await db.select().from(hosts).where(eq(hosts.id, project.hostId)).limit(1);
  if (!host || !host.opencodeEnabled) {
    return NextResponse.json({
      sessions: [],
      error: 'OpenCode Server отключен в настройках этого сервера',
      host: {
        id: host?.id,
        name: host?.name,
        ip: host?.ipAddress,
        opencodeEnabled: false,
      },
    });
  }

  // Find project deployment directory on the host if available
  const [deployment] = await db
    .select()
    .from(deployments)
    .where(eq(deployments.projectId, projectId))
    .limit(1);

  try {
    const [rawSessions, statusMap] = await Promise.all([
      listOpenCodeSessions(host as OpenCodeHostConfig),
      getOpenCodeSessionStatuses(host as OpenCodeHostConfig),
    ]);

    // Fetch existing runs in DB for this project to enrich session metadata
    const runs = await db
      .select()
      .from(opencodeRuns)
      .where(eq(opencodeRuns.projectId, projectId))
      .orderBy(desc(opencodeRuns.createdAt));

    const runsBySession = new Map<string, typeof runs[0]>();
    for (const r of runs) {
      if (r.sessionId && !runsBySession.has(r.sessionId)) {
        runsBySession.set(r.sessionId, r);
      }
    }

    const sessions = rawSessions.map((s: any) => {
      const run = runsBySession.get(s.id);
      let parsedMeta: any = null;
      if (run?.metadata) {
        try { parsedMeta = JSON.parse(run.metadata); } catch {}
      }
      const isBusy = statusMap[s.id]?.type === 'busy';

      return {
        id: s.id,
        title: s.title || run?.title || `Сессия ${s.id.slice(-6)}`,
        directory: s.directory || parsedMeta?.directory || deployment?.deployPath || undefined,
        model: s.model || (parsedMeta?.model ? { id: parsedMeta.model, variant: parsedMeta.variant } : undefined),
        createdAt: s.time?.created || s.createdAt || run?.createdAt || Date.now(),
        updatedAt: s.time?.updated || s.updatedAt || run?.completedAt || undefined,
        status: isBusy ? 'running' : (run?.status || 'idle'),
        lastRunId: run?.id,
        lastPrompt: run?.prompt,
        lastError: run?.errorMessage,
      };
    });

    return NextResponse.json({
      sessions,
      project: {
        id: project.id,
        title: project.title,
        deployPath: deployment?.deployPath || null,
      },
      host: {
        id: host.id,
        name: host.name,
        ip: host.ipAddress,
        opencodeHost: host.opencodeHost,
        opencodePort: host.opencodePort,
        opencodeUseHttps: host.opencodeUseHttps,
        opencodeEnabled: true,
      },
    });
  } catch (err: any) {
    console.error(`[API /api/projects/${projectId}/opencode/sessions GET] Error:`, err);
    return NextResponse.json(
      { sessions: [], error: err.message || 'Ошибка загрузки сессий OpenCode' },
      { status: 200 }
    );
  }
}

/**
 * POST /api/projects/:id/opencode/sessions
 * Creates a new OpenCode session on the project's host with its deploy directory.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (!(await canUserEditProject(auth, projectId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!project.hostId) {
    return NextResponse.json(
      { error: 'Проект не привязан к серверу с OpenCode' },
      { status: 400 }
    );
  }

  const [host] = await db.select().from(hosts).where(eq(hosts.id, project.hostId)).limit(1);
  if (!host || !host.opencodeEnabled) {
    return NextResponse.json(
      { error: 'OpenCode отключен или хост недоступен' },
      { status: 400 }
    );
  }

  // Find project deployment directory on the host if available
  const [deployment] = await db
    .select()
    .from(deployments)
    .where(eq(deployments.projectId, projectId))
    .limit(1);

  const body = await req.json().catch(() => ({}));
  const now = new Date();
  const defaultTitle = `${project.title}: Диалог ${now.toLocaleDateString('ru-RU')} ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  const title = (body.title && body.title.trim().length > 0) ? body.title.trim() : defaultTitle;
  const directory = body.directory || deployment?.deployPath || null;

  try {
    const session = await createOpenCodeSession(host as OpenCodeHostConfig, title, directory);
    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        title: session.title || title,
        directory: session.directory || directory,
        createdAt: session.time?.created || Date.now(),
      },
    });
  } catch (err: any) {
    console.error(`[API /api/projects/${projectId}/opencode/sessions POST] Error:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Не удалось создать сессию OpenCode' },
      { status: 500 }
    );
  }
}
