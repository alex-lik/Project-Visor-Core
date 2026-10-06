import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kanbanTasks, kanbanTaskComments, projects, activityLogs, users } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { dispatchNotification } from '@/lib/notifications';
import { eq, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: taskId } = await params;
  const [task] = await db.select().from(kanbanTasks).where(eq(kanbanTasks.id, taskId)).limit(1);
  if (!task) {
    return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
  }

  if (!isProjectAllowed(auth, task.projectId)) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  const comments = await db
    .select()
    .from(kanbanTaskComments)
    .where(eq(kanbanTaskComments.taskId, taskId))
    .orderBy(asc(kanbanTaskComments.createdAt));

  return NextResponse.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!auth.canWriteKanban) {
    return NextResponse.json({ error: 'Forbidden: No kanban write permission' }, { status: 403 });
  }

  const { id: taskId } = await params;
  const [task] = await db.select().from(kanbanTasks).where(eq(kanbanTasks.id, taskId)).limit(1);
  if (!task) {
    return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
  }

  if (!isProjectAllowed(auth, task.projectId)) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const content = (body.content || '').trim();
    if (!content) {
      return NextResponse.json({ error: 'Текст комментария не может быть пустым' }, { status: 400 });
    }

    // Resolve author
    let authorName = (body.authorName || '').trim();
    let authorType = body.authorType || (auth.isUser ? 'user' : 'agent');

    if (!authorName) {
      if (auth.isUser) {
        if (auth.userId) {
          const [u] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
          authorName = u?.username || 'Пользователь';
        } else {
          authorName = 'Admin';
        }
      } else {
        authorName = auth.keyName || 'AI Agent';
      }
    }

    const commentId = `comm_${nanoid(10)}`;
    const now = Date.now();

    await db.insert(kanbanTaskComments).values({
      id: commentId,
      taskId,
      authorType,
      authorName,
      content,
      createdAt: now,
      updatedAt: now,
    });

    // Touch task updatedAt
    await db.update(kanbanTasks).set({ updatedAt: now }).where(eq(kanbanTasks.id, taskId));

    // Audit log
    await db.insert(activityLogs).values({
      id: `act_${nanoid(10)}`,
      actorType: authorType,
      actorName: authorName,
      action: 'task_comment_added',
      projectId: task.projectId,
      details: `Комментарий к задаче "${task.title}": ${content.slice(0, 60)}`,
      createdAt: now,
    });

    // Notification
    dispatchNotification({
      event: 'task_comment_added',
      title: `Новый комментарий к задаче "${task.title}"`,
      message: `${authorName}: ${content.slice(0, 100)}`,
      projectId: task.projectId,
      userId: auth.userId || undefined,
      data: {
        taskId: task.id,
        taskTitle: task.title,
        authorName,
        authorType,
      },
      url: `/projects/${task.projectId}`,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      comment: {
        id: commentId,
        taskId,
        authorType,
        authorName,
        content,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Ошибка добавления комментария' },
      { status: 500 }
    );
  }
}
