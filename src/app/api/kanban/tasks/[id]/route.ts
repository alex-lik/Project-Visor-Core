import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kanbanTasks, kanbanTaskComments, kanbanBoards, projects, activityLogs } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { isBoardAllowed, isTaskAllowed } from '@/lib/kanban-access';
import { dispatchNotification } from '@/lib/notifications';
import { eq, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [task] = await db.select().from(kanbanTasks).where(eq(kanbanTasks.id, id)).limit(1);
  if (!task) {
    return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
  }

  if (!(await isTaskAllowed(auth, task))) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  const [project] = task.projectId
    ? await db.select().from(projects).where(eq(projects.id, task.projectId)).limit(1)
    : [undefined];
  const [board] = task.boardId
    ? await db.select().from(kanbanBoards).where(eq(kanbanBoards.id, task.boardId)).limit(1)
    : [undefined];
  const comments = await db
    .select()
    .from(kanbanTaskComments)
    .where(eq(kanbanTaskComments.taskId, id))
    .orderBy(asc(kanbanTaskComments.createdAt));

  const parsedChecklists = (() => {
    try {
      return JSON.parse(task.checklists || '[]');
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
    task.progressMode === 'manual' && typeof task.progress === 'number'
      ? task.progress
      : totalChecklistItems > 0
      ? Math.round((completedChecklistItems / totalChecklistItems) * 100)
      : typeof task.progress === 'number'
      ? task.progress
      : null;

  const isPersonal = board?.kind === 'personal';

  return NextResponse.json({
    task: {
      ...task,
      tags: (() => {
        try {
          return JSON.parse(task.tags || '[]');
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
      projectTitle: project?.title || (isPersonal ? 'Личное' : 'Unknown Project'),
      projectSlug: project?.slug || '',
      boardId: board?.id || task.boardId || null,
      boardKind: board?.kind || 'project',
      boardTitle: board?.title || '',
      comments,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if ((auth as any).isDemo === true) {
    return NextResponse.json({ error: 'Демо-режим: изменение задач отключено (только просмотр мок-данных)' }, { status: 403 });
  }

  if (!auth.canWriteKanban) {
    return NextResponse.json({ error: 'Forbidden: No kanban write permission' }, { status: 403 });
  }

  const { id } = await params;
  const [task] = await db.select().from(kanbanTasks).where(eq(kanbanTasks.id, id)).limit(1);
  if (!task) {
    return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
  }

  if (!(await isTaskAllowed(auth, task))) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const updateData: any = { updatedAt: Date.now() };
    const logDetails: string[] = [];
    let logProjectId: string | null | undefined = task.projectId;

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.tags !== undefined) updateData.tags = JSON.stringify(body.tags);
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? Number(body.dueDate) : null;
    if (body.position !== undefined) updateData.position = Number(body.position);
    if (body.color !== undefined) updateData.color = body.color || null;
    if (body.checklists !== undefined) {
      updateData.checklists = typeof body.checklists === 'string' ? body.checklists : JSON.stringify(body.checklists);
    }
    if (body.progress !== undefined) {
      updateData.progress = body.progress !== null ? Number(body.progress) : null;
    }
    if (body.progressMode !== undefined) updateData.progressMode = body.progressMode;
    if (body.assigneeName !== undefined) updateData.assigneeName = body.assigneeName || null;

    if (body.isArchived !== undefined && Number(body.isArchived) !== task.isArchived) {
      const isArchiving = Number(body.isArchived) === 1;
      updateData.isArchived = isArchiving ? 1 : 0;

      logDetails.push(isArchiving ? `Задача "${task.title}" отправлена в архив` : `Задача "${task.title}" восстановлена из архива`);
    }

    if (body.column && body.column !== task.column) {
      updateData.column = body.column;
      logDetails.push(`Задача "${task.title}" перемещена в "${body.column}"`);

      const isCompleted = body.column === 'done';
      dispatchNotification({
        event: isCompleted ? 'task_completed' : 'task_moved',
        title: isCompleted ? `✓ Задача выполнена: "${task.title}"` : `Задача перемещена: "${task.title}"`,
        message: isCompleted
          ? `Задача переведена в колонку "Done".`
          : `Задача переведена из "${task.column}" в "${body.column}".`,
        projectId: task.projectId ?? undefined,
        userId: auth.userId || undefined,
        data: {
          taskTitle: task.title,
          fromColumn: task.column,
          column: body.column,
          priority: task.priority,
        },
        url: task.projectId ? `/projects/${task.projectId}` : '/tasks',
      }).catch(() => {});
    }

    // Перенос задачи на другую доску (проектную или личную)
    if (body.boardId && body.boardId !== task.boardId) {
      const [targetBoard] = await db.select().from(kanbanBoards).where(eq(kanbanBoards.id, body.boardId)).limit(1);
      if (!targetBoard || !isBoardAllowed(auth, targetBoard)) {
        return NextResponse.json({ error: 'Доступ к целевой доске запрещен' }, { status: 403 });
      }

      const newProjectId = targetBoard.kind === 'project' ? targetBoard.projectId : null;
      updateData.boardId = targetBoard.id;
      updateData.projectId = newProjectId;
      logProjectId = newProjectId;
      logDetails.push(
        `Задача "${task.title}" перенесена на доску "${targetBoard.title}"`
      );

      dispatchNotification({
        event: 'task_moved',
        title: `Задача перенесена на доску: "${task.title}"`,
        message: `Задача "${task.title}" перенесена на доску "${targetBoard.title}".`,
        projectId: newProjectId ?? undefined,
        userId: auth.userId || undefined,
        data: {
          taskTitle: task.title,
          toBoard: targetBoard.title,
        },
        url: newProjectId ? `/projects/${newProjectId}` : '/tasks',
      }).catch(() => {});
    }

    await db.update(kanbanTasks).set(updateData).where(eq(kanbanTasks.id, id));

    if (logDetails.length > 0) {
      await db.insert(activityLogs).values({
        id: `act_${nanoid(10)}`,
        actorType: auth.isUser ? 'user' : 'agent',
        actorName: auth.isUser ? 'Admin' : auth.keyName || 'Agent',
        action: updateData.isArchived !== undefined ? (updateData.isArchived === 1 ? 'task_archived' : 'task_restored') : body.boardId ? 'task_moved_to_board' : 'task_moved',
        projectId: (logProjectId ?? null) as string | null,
        details: logDetails.join('; '),
        createdAt: Date.now(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка обновления задачи' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if ((auth as any).isDemo === true) {
    return NextResponse.json({ error: 'Демо-режим: удаление задач отключено (только просмотр мок-данных)' }, { status: 403 });
  }

  if (!auth.canWriteKanban) {
    return NextResponse.json({ error: 'Forbidden: No kanban write permission' }, { status: 403 });
  }

  const { id } = await params;
  const [task] = await db.select().from(kanbanTasks).where(eq(kanbanTasks.id, id)).limit(1);
  if (!task) {
    return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
  }

  if (!(await isTaskAllowed(auth, task))) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  // Delete comments first
  await db.delete(kanbanTaskComments).where(eq(kanbanTaskComments.taskId, id));
  await db.delete(kanbanTasks).where(eq(kanbanTasks.id, id));

  await db.insert(activityLogs).values({
    id: `act_${nanoid(10)}`,
    actorType: auth.isUser ? 'user' : 'agent',
    actorName: auth.isUser ? 'Admin' : auth.keyName || 'Agent',
    action: 'task_deleted',
    projectId: task.projectId ?? null,
    details: `Удалена задача "${task.title}"`,
    createdAt: Date.now(),
  });

  return NextResponse.json({ success: true });
}
