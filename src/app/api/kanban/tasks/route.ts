import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kanbanTasks, projects, activityLogs } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { dispatchNotification } from '@/lib/notifications';
import { nanoid } from 'nanoid';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const column = searchParams.get('column');

  const allProjects = await db.select().from(projects);
  const allowedProjects = allProjects.filter((p) => isProjectAllowed(auth, p.id));
  const allowedIds = new Set(allowedProjects.map((p) => p.id));

  let tasks = await db.select().from(kanbanTasks).orderBy(desc(kanbanTasks.updatedAt));

  tasks = tasks.filter((t) => allowedIds.has(t.projectId));

  if (projectId) {
    tasks = tasks.filter((t) => t.projectId === projectId);
  }
  if (column) {
    tasks = tasks.filter((t) => t.column === column);
  }

  const enriched = tasks.map((t) => {
    const p = allProjects.find((proj) => proj.id === t.projectId);
    return {
      ...t,
      tags: JSON.parse(t.tags || '[]'),
      projectTitle: p?.title || 'Unknown Project',
      projectSlug: p?.slug || '',
      projectCategory: p?.category || 'system',
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

  if (!auth.canWriteKanban) {
    return NextResponse.json({ error: 'Forbidden: No permission to write to kanban' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { projectId, title, description, column = 'todo', priority = 'medium', tags = [], dueDate } = body;

    if (!projectId || !title) {
      return NextResponse.json({ error: 'projectId и title обязательны' }, { status: 400 });
    }

    if (!isProjectAllowed(auth, projectId)) {
      return NextResponse.json({ error: 'Доступ к проекту запрещен' }, { status: 403 });
    }

    const taskId = `task_${nanoid(10)}`;
    await db.insert(kanbanTasks).values({
      id: taskId,
      projectId,
      title,
      description: description || '',
      column,
      priority,
      position: 0,
      tags: JSON.stringify(tags || []),
      dueDate: dueDate ? Number(dueDate) : null,
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
      projectId,
      userId: auth.userId || undefined,
      data: {
        taskTitle: title,
        column,
        priority,
      },
      url: `/projects/${projectId}`,
    }).catch(() => {});

    return NextResponse.json({ success: true, taskId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка создания задачи' }, { status: 500 });
  }
}
