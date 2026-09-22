import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kanbanTasks, activityLogs } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { dispatchNotification } from '@/lib/notifications';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!auth.canWriteKanban) {
    return NextResponse.json({ error: 'Forbidden: No kanban write permission' }, { status: 403 });
  }

  const { id } = await params;
  const [task] = await db.select().from(kanbanTasks).where(eq(kanbanTasks.id, id)).limit(1);
  if (!task) {
    return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
  }

  if (!isProjectAllowed(auth, task.projectId)) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const updateData: any = { updatedAt: Date.now() };

    if (body.title) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.priority) updateData.priority = body.priority;
    if (body.tags) updateData.tags = JSON.stringify(body.tags);
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? Number(body.dueDate) : null;
    if (body.position !== undefined) updateData.position = Number(body.position);

    if (body.column && body.column !== task.column) {
      updateData.column = body.column;

      await db.insert(activityLogs).values({
        id: `act_${nanoid(10)}`,
        actorType: auth.isUser ? 'user' : 'agent',
        actorName: auth.isUser ? 'Admin' : auth.keyName || 'Agent',
        action: 'task_moved',
        projectId: task.projectId,
        details: `Задача "${task.title}" перемещена в "${body.column}"`,
        createdAt: Date.now(),
      });

      const isCompleted = body.column === 'done';
      dispatchNotification({
        event: isCompleted ? 'task_completed' : 'task_moved',
        title: isCompleted ? `✓ Задача выполнена: "${task.title}"` : `Задача перемещена: "${task.title}"`,
        message: isCompleted
          ? `Задача переведена в колонку "Done".`
          : `Задача переведена из "${task.column}" в "${body.column}".`,
        projectId: task.projectId,
        userId: auth.userId || undefined,
        data: {
          taskTitle: task.title,
          column: body.column,
          priority: task.priority,
        },
        url: `/projects/${task.projectId}`,
      }).catch(() => {});
    }

    await db.update(kanbanTasks).set(updateData).where(eq(kanbanTasks.id, id));
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

  if (!auth.canWriteKanban) {
    return NextResponse.json({ error: 'Forbidden: No kanban write permission' }, { status: 403 });
  }

  const { id } = await params;
  const [task] = await db.select().from(kanbanTasks).where(eq(kanbanTasks.id, id)).limit(1);
  if (!task) {
    return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
  }

  if (!isProjectAllowed(auth, task.projectId)) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  await db.delete(kanbanTasks).where(eq(kanbanTasks.id, id));
  return NextResponse.json({ success: true });
}
