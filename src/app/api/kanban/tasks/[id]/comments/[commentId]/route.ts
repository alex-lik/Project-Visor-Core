import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kanbanTasks, kanbanTaskComments } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { eq, and } from 'drizzle-orm';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!auth.canWriteKanban) {
    return NextResponse.json({ error: 'Forbidden: No kanban write permission' }, { status: 403 });
  }

  const { id: taskId, commentId } = await params;
  const [task] = await db.select().from(kanbanTasks).where(eq(kanbanTasks.id, taskId)).limit(1);
  if (!task) {
    return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
  }

  if (!isProjectAllowed(auth, task.projectId)) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  await db
    .delete(kanbanTaskComments)
    .where(and(eq(kanbanTaskComments.id, commentId), eq(kanbanTaskComments.taskId, taskId)));

  return NextResponse.json({ success: true });
}
