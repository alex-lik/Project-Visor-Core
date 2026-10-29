import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kanbanTasks, kanbanTaskComments, kanbanBoards, projects, activityLogs } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { dispatchNotification } from '@/lib/notifications';
import { ensureProjectBoard, isBoardAllowed, isTaskAllowed } from '@/lib/kanban-access';
import { nanoid } from 'nanoid';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const boardId = searchParams.get('boardId');
  const column = searchParams.get('column');
  const archived = searchParams.get('archived'); // 'only' | 'true' | 'false' (default: false)

  const allProjects = await db.select().from(projects);
  const allowedProjects = allProjects.filter((p) => isProjectAllowed(auth, p.id));
  const allowedIds = new Set(allowedProjects.map((p) => p.id));

  // Доступные доски: проектные (по RBAC проектов) + личные (свои, для админов — все личные списком не нужны)
  const allBoards = await db.select().from(kanbanBoards);
  const allowedBoardIds = new Set(allBoards.filter((b) => isBoardAllowed(auth, b)).map((b) => b.id));

  let tasks = await db.select().from(kanbanTasks).orderBy(desc(kanbanTasks.updatedAt));

  // Доступ: через доску, либо legacy-фоллбек по проекту (задачи без board_id)
  tasks = tasks.filter(
    (t) => (t.boardId ? allowedBoardIds.has(t.boardId) : allowedIds.has(t.projectId || ''))
  );

  // Filter by archive state
  if (archived === 'only') {
    tasks = tasks.filter((t) => t.isArchived === 1);
  } else if (archived !== 'true') {
    tasks = tasks.filter((t) => t.isArchived !== 1);
  }

  if (projectId) {
    tasks = tasks.filter((t) =>
      t.projectId === projectId ||
      (!!t.boardId && allBoards.some((b) => b.id === t.boardId && b.kind === 'project' && b.projectId === projectId))
    );
  }
  if (boardId) {
    tasks = tasks.filter((t) => t.boardId === boardId);
  }
  if (column) {
    tasks = tasks.filter((t) => t.column === column);
  }

  const boardMap = new Map(allBoards.map((b) => [b.id, b]));

  // Fetch comments count map
  const allComments = await db
    .select({ id: kanbanTaskComments.id, taskId: kanbanTaskComments.taskId })
    .from(kanbanTaskComments);
  const commentCountMap: Record<string, number> = {};
  for (const c of allComments) {
    commentCountMap[c.taskId] = (commentCountMap[c.taskId] || 0) + 1;
  }

  const enriched = tasks.map((t) => {
    const p = t.projectId ? allProjects.find((proj) => proj.id === t.projectId) : undefined;
    const board = t.boardId ? boardMap.get(t.boardId) : undefined;
    const parsedChecklists = (() => {
      try {
        return JSON.parse(t.checklists || '[]');
      } catch {
        return [];
      }
    })();

    let totalChecklistItems = 0;
    let completedChecklistItems = 0;
    if (Array.isArray(parsedChecklists)) {
      for (const cl of parsedChecklists) {
        if (Array.isArray(cl.items)) {
          totalChecklistItems += cl.items.length;
          completedChecklistItems += cl.items.filter((item: any) => item.completed).length;
        }
      }
    }

    const calculatedProgress =
      t.progressMode === 'manual' && typeof t.progress === 'number'
        ? t.progress
        : totalChecklistItems > 0
        ? Math.round((completedChecklistItems / totalChecklistItems) * 100)
        : typeof t.progress === 'number'
        ? t.progress
        : null;

    const isPersonal = board?.kind === 'personal';

    return {
      ...t,
      tags: (() => {
        try {
          return JSON.parse(t.tags || '[]');
        } catch {
          return [];
        }
      })(),
      checklists: parsedChecklists,
      checklistStats: {
        total: totalChecklistItems,
        completed: completedChecklistItems,
      },
      effectiveProgress: calculatedProgress,
      commentsCount: commentCountMap[t.id] || 0,
      projectTitle: p?.title || (isPersonal ? 'Личное' : 'Unknown Project'),
      projectSlug: p?.slug || '',
      projectCategory: p?.category || 'system',
      boardId: t.boardId || board?.id || null,
      boardKind: board?.kind || 'project',
      boardTitle: board?.title || '',
    };
  });

  return NextResponse.json({
    total: enriched.length,
    tasks: enriched,
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if ((auth as any).isDemo === true) {
    return NextResponse.json({ error: 'Демо-режим: изменение задач отключено (только просмотр мок-данных)' }, { status: 403 });
  }

  if (!auth.canWriteKanban) {
    return NextResponse.json({ error: 'Forbidden: No permission to write to kanban' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      projectId: projectIdInput,
      boardId: boardIdInput,
      title,
      description,
      column = 'todo',
      priority = 'medium',
      tags = [],
      dueDate,
      color = null,
      checklists = [],
      progress = null,
      progressMode = 'auto',
      assigneeName = null,
    } = body;

    if (!title || (!projectIdInput && !boardIdInput)) {
      return NextResponse.json({ error: 'projectId (или boardId) и title обязательны' }, { status: 400 });
    }

    let projectId: string | null = null;
    let targetBoardId: string | null = null;

    if (boardIdInput) {
      const [board] = await db.select().from(kanbanBoards).where(eq(kanbanBoards.id, boardIdInput)).limit(1);
      if (!board || !isBoardAllowed(auth, board)) {
        return NextResponse.json({ error: 'Доступ к доске запрещен' }, { status: 403 });
      }
      targetBoardId = board.id;
      projectId = board.kind === 'project' ? board.projectId : null;
    } else {
      projectId = projectIdInput;
      if (!isProjectAllowed(auth, projectId!)) {
        return NextResponse.json({ error: 'Доступ к проекту запрещен' }, { status: 403 });
      }
      // Лениво создаём/находим проектную доску и привязываем задачу к ней
      const board = await ensureProjectBoard(projectId!);
      targetBoardId = board.id;
    }

    const taskId = `task_${nanoid(10)}`;
    await db.insert(kanbanTasks).values({
      id: taskId,
      projectId,
      boardId: targetBoardId,
      title,
      description: description || '',
      column,
      priority,
      position: 0,
      tags: JSON.stringify(tags || []),
      dueDate: dueDate ? Number(dueDate) : null,
      isArchived: 0,
      color: color || null,
      checklists: typeof checklists === 'string' ? checklists : JSON.stringify(checklists || []),
      progress: progress !== null && progress !== undefined ? Number(progress) : null,
      progressMode: progressMode || 'auto',
      assigneeName: assigneeName || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await db.insert(activityLogs).values({
      id: `act_${nanoid(10)}`,
      actorType: auth.isUser ? 'user' : 'agent',
      actorName: auth.isUser ? 'Admin' : auth.keyName || 'Agent',
      action: 'task_created',
      projectId,
      details: `Создана задача: "${title}" [${column}]`,
      createdAt: Date.now(),
    });

    dispatchNotification({
      event: 'task_created',
      title: `Новая задача: "${title}"`,
      message: `Создана задача в колонке "${column}" с приоритетом "${priority}".\n${description || ''}`.trim(),
      projectId: projectId ?? undefined,
      userId: auth.userId || undefined,
      data: {
        taskTitle: title,
        column,
        priority,
      },
      url: projectId ? `/projects/${projectId}` : '/tasks',
    }).catch(() => {});

    return NextResponse.json({ success: true, taskId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка создания задачи' }, { status: 500 });
  }
}
