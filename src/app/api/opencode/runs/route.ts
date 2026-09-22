import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { opencodeRuns, hosts, projects, users, deployments } from '@/db/schema';
import { authenticateRequest } from '@/lib/rbac';
import { canUserEditProject } from '@/lib/project-access';
import { executeOpenCodeRun } from '@/lib/opencode';
import { dispatchNotification } from '@/lib/notifications';
import { eq, desc, and } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const hostId = searchParams.get('hostId');

  let query = db.select().from(opencodeRuns);

  if (projectId && hostId) {
    query = query.where(and(eq(opencodeRuns.projectId, projectId), eq(opencodeRuns.hostId, hostId))) as any;
  } else if (projectId) {
    query = query.where(eq(opencodeRuns.projectId, projectId)) as any;
  } else if (hostId) {
    query = query.where(eq(opencodeRuns.hostId, hostId)) as any;
  }

  const runs = await query.orderBy(desc(opencodeRuns.createdAt)).limit(100);

  // Enrich with host and project details
  const allHosts = await db.select().from(hosts);
  const allProjects = await db.select().from(projects);

  const enrichedRuns = runs.map((run) => {
    const host = allHosts.find((h) => h.id === run.hostId);
    const project = allProjects.find((p) => p.id === run.projectId);
    return {
      ...run,
      hostName: host?.name || 'Unknown Host',
      hostIp: host?.ipAddress || null,
      projectTitle: project?.title || null,
      projectSlug: project?.slug || null,
    };
  });

  return NextResponse.json({ runs: enrichedRuns });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      projectId,
      hostId: explicitHostId,
      prompt,
      title,
      directory: explicitDirectory,
      sessionId,
      model,
      reasoningEffort,
    } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    let targetHostId = explicitHostId;
    let targetProject = null;

    if (projectId) {
      const [p] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!p) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      // Check permission: user must have editor or owner rights on project
      const canEdit = await canUserEditProject(auth, projectId);
      if (!canEdit) {
        return NextResponse.json({ error: 'Forbidden: You do not have permission to run OpenCode on this project' }, { status: 403 });
      }

      targetProject = p;
      if (!targetHostId) {
        targetHostId = p.hostId;
      }
    }

    if (!targetHostId) {
      return NextResponse.json({ error: 'Host ID is required or project must be assigned to a host' }, { status: 400 });
    }

    const [targetHost] = await db.select().from(hosts).where(eq(hosts.id, targetHostId)).limit(1);
    if (!targetHost) {
      return NextResponse.json({ error: 'Assigned server host not found' }, { status: 404 });
    }

    // Рабочая директория проекта на удаленном хосте: явная из запроса или deployPath из профиля деплоя
    let directory: string | null = explicitDirectory?.trim() || null;
    if (!directory && targetProject) {
      const [dep] = await db.select().from(deployments).where(eq(deployments.projectId, targetProject.id)).limit(1);
      if (dep?.deployPath) directory = dep.deployPath;
    }

    // Execute run through OpenCode Server
    const run = await executeOpenCodeRun({
      host: targetHost,
      project: targetProject,
      prompt: prompt.trim(),
      title: title?.trim() || (prompt.slice(0, 60) + (prompt.length > 60 ? '...' : '')),
      userId: auth.userId || null,
      actorName: auth.username || 'Visor User',
      directory,
      existingSessionId: sessionId?.trim() || undefined,
      model: model?.trim() || undefined,
      reasoningEffort: reasoningEffort?.trim() || undefined,
    });

    // Dispatch notification (Level 2)
    const isSuccess = run.status === 'completed';
    const diffLines = run.diff ? run.diff.split('\n').filter(Boolean).length : 0;
    dispatchNotification({
      event: isSuccess ? 'opencode_completed' : 'opencode_failed',
      title: isSuccess ? `OpenCode: ${run.title}` : `OpenCode ошибка: ${run.title}`,
      message: isSuccess
        ? `Запуск OpenCode успешно завершен на сервере "${targetHost.name}". Изменений в git: ${diffLines} строк.`
        : `Запуск OpenCode завершился ошибкой на сервере "${targetHost.name}".`,
      projectId: targetProject?.id,
      projectTitle: targetProject?.title,
      userId: auth.userId || undefined,
      data: {
        taskTitle: run.title || undefined,
        hostName: targetHost.name,
        diff: run.diff || undefined,
        filesChanged: diffLines,
        errorMessage: run.errorMessage || undefined,
        runId: run.id,
      },
      url: targetProject ? `/projects/${targetProject.id}` : undefined,
    }).catch(() => {});

    return NextResponse.json({ run });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to trigger OpenCode run' }, { status: 500 });
  }
}
