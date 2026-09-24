import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, hosts, opencodeRuns, deployments, activityLogs } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { canUserEditProject } from '@/lib/project-access';
import {
  fetchOpenCodeSessionChat,
  sendOpenCodePrompt,
  getOpenCodeDiff,
  updateOpenCodeSession,
  deleteOpenCodeSession,
  abortOpenCodeSession,
  OpenCodeHostConfig,
} from '@/lib/opencode';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * GET /api/projects/:id/opencode/sessions/:sessionId
 * Returns the entire conversation history (user & assistant messages) and git diff for a session.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId, sessionId } = await params;
  if (!auth.isAdmin && !isProjectAllowed(auth, projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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

  try {
    const chatData = await fetchOpenCodeSessionChat(host as OpenCodeHostConfig, sessionId);
    if (!chatData) {
      return NextResponse.json(
        { error: 'Сессия OpenCode не найдена или вернула некорректный ответ' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: chatData.sessionId,
      messages: chatData.messages,
      diff: chatData.diff,
      isGenerating: chatData.isGenerating,
      assistantText: chatData.assistantText,
      model: chatData.model,
      directory: chatData.directory,
      title: chatData.title,
    });
  } catch (err: any) {
    console.error(`[API /api/projects/${projectId}/opencode/sessions/${sessionId} GET] Error:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Ошибка загрузки сообщений диалога' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/:id/opencode/sessions/:sessionId
 * Sends a message turn into an existing OpenCode session and logs it into Visor runs.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId, sessionId } = await params;
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (!(await canUserEditProject(auth, projectId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!project.hostId) {
    return NextResponse.json(
      { error: 'Проект не привязан к серверу инфраструктуры' },
      { status: 400 }
    );
  }

  const [host] = await db.select().from(hosts).where(eq(hosts.id, project.hostId)).limit(1);
  if (!host || !host.opencodeEnabled) {
    return NextResponse.json(
      { error: 'OpenCode отключен на сервере проекта' },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));

  if (body.abort) {
    const aborted = await abortOpenCodeSession(host as OpenCodeHostConfig, sessionId);
    await db.update(opencodeRuns)
      .set({ status: 'failed', errorMessage: 'Прервано пользователем', completedAt: Date.now() })
      .where(eq(opencodeRuns.sessionId, sessionId));
    return NextResponse.json({ success: aborted, aborted: true });
  }

  const { prompt, model, reasoningEffort, variant, agent, title } = body;
  const selectedVariant = variant || reasoningEffort || undefined;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'Промпт не может быть пустым' }, { status: 400 });
  }

  const runId = `ocr_${nanoid(16)}`;
  const startTime = Date.now();
  const runTitle = title?.trim() || prompt.trim().slice(0, 60) + (prompt.trim().length > 60 ? '...' : '');

  // Find deployment info
  const [deployment] = await db
    .select()
    .from(deployments)
    .where(eq(deployments.projectId, projectId))
    .limit(1);

  // Insert pending run
  await db.insert(opencodeRuns).values({
    id: runId,
    hostId: host.id,
    projectId,
    userId: auth.userId || null,
    sessionId,
    title: runTitle,
    prompt: prompt.trim(),
    status: 'running',
    createdAt: startTime,
    metadata: JSON.stringify({
      hostName: host.name,
      hostUrl: `${host.opencodeUseHttps ? 'https' : 'http'}://${host.opencodeHost || host.ipAddress}`,
      hostDomain: host.opencodeHost || host.ipAddress,
      model: model || 'default',
      variant: selectedVariant || null,
      reasoningEffort: selectedVariant || null,
      directory: deployment?.deployPath || null,
    }),
  });

  try {
    const { textResponse, raw } = await sendOpenCodePrompt(
      host as OpenCodeHostConfig,
      sessionId,
      prompt.trim(),
      { model, variant: selectedVariant, reasoningEffort: selectedVariant, agent }
    );

    const diff = await getOpenCodeDiff(host as OpenCodeHostConfig, sessionId);
    const completedTime = Date.now();

    await db
      .update(opencodeRuns)
      .set({
        response: textResponse,
        diff,
        status: 'completed',
        completedAt: completedTime,
        errorMessage: null,
      })
      .where(eq(opencodeRuns.id, runId));

    // Fetch fresh chat history to return to client
    const freshChat = await fetchOpenCodeSessionChat(host as OpenCodeHostConfig, sessionId);

    return NextResponse.json({
      success: true,
      runId,
      textResponse,
      diff,
      messages: freshChat?.messages || [],
      isGenerating: false,
    });
  } catch (err: any) {
    const isCloudflare524 = Boolean(err.isCloudflare524);
    const completedTime = Date.now();

    if (isCloudflare524) {
      // 524 Timeout: Process is still executing in background on server
      await db
        .update(opencodeRuns)
        .set({
          status: 'running',
          errorMessage:
            'Таймаут Cloudflare (524): Время генерации ответа превысило 120 секунд. Процесс продолжается в фоне на сервере.',
          metadata: JSON.stringify({
            hostName: host.name,
            hostDomain: host.opencodeHost || host.ipAddress,
            model: model || 'default',
            isCloudflare524: true,
            durationMs: completedTime - startTime,
            rawDetails: err.rawDetails || null,
          }),
        })
        .where(eq(opencodeRuns.id, runId));

      const currentChat = await fetchOpenCodeSessionChat(host as OpenCodeHostConfig, sessionId);

      return NextResponse.json({
        success: true,
        runId,
        isCloudflare524: true,
        status: 'running',
        message: 'Задача выполняется в фоне на сервере OpenCode (лимит Cloudflare 120с).',
        messages: currentChat?.messages || [],
        isGenerating: true,
      });
    }

    // Normal error
    await db
      .update(opencodeRuns)
      .set({
        status: 'failed',
        errorMessage: err.message || 'Ошибка выполнения OpenCode',
        completedAt: completedTime,
      })
      .where(eq(opencodeRuns.id, runId));

    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Ошибка отправки сообщения в OpenCode',
        runId,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/:id/opencode/sessions/:sessionId
 * Renames an OpenCode session and updates related Visor records.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId, sessionId } = await params;
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

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title.trim() : '';

  if (!title) {
    return NextResponse.json({ error: 'Название сессии не может быть пустым' }, { status: 400 });
  }

  try {
    const updated = await updateOpenCodeSession(host as OpenCodeHostConfig, sessionId, { title });

    // Update Visor DB run records matching this session for consistent search and audit
    await db
      .update(opencodeRuns)
      .set({ title })
      .where(eq(opencodeRuns.sessionId, sessionId));

    return NextResponse.json({
      success: true,
      session: {
        id: sessionId,
        title: updated?.title || title,
      },
    });
  } catch (err: any) {
    console.error(`[API /api/projects/${projectId}/opencode/sessions/${sessionId} PATCH] Error:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Ошибка обновления сессии OpenCode' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id/opencode/sessions/:sessionId
 * Permanently deletes an OpenCode session and cleans up Visor records.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId, sessionId } = await params;
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

  try {
    await deleteOpenCodeSession(host as OpenCodeHostConfig, sessionId);

    // Clean up local opencodeRuns entries for this session
    await db.delete(opencodeRuns).where(eq(opencodeRuns.sessionId, sessionId));

    // Audit log
    await db.insert(activityLogs).values({
      id: nanoid(),
      actorType: 'user',
      actorName: auth.username || 'User',
      action: 'opencode_session_deleted',
      projectId,
      details: `Удалена сессия OpenCode ${sessionId} на сервере "${host.name}"`,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      message: 'Сессия OpenCode успешно удалена',
    });
  } catch (err: any) {
    console.error(`[API /api/projects/${projectId}/opencode/sessions/${sessionId} DELETE] Error:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Ошибка удаления сессии OpenCode' },
      { status: 500 }
    );
  }
}
