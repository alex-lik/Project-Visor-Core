import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kanbanBoards, kanbanTasks, projects } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { ensureProjectBoard, isBoardAllowed, getAccessibleBoards } from '@/lib/kanban-access';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';

/** GET /api/kanban/boards — список доступных досок.
 * ?kind=personal|project — фильтр по типу; ?projectId=X — доска конкретного проекта (создаётся, если её нет).
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind');
  const projectId = searchParams.get('projectId');

  if (projectId) {
    const project = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project.length || !isProjectAllowed(auth, projectId)) {
      return NextResponse.json({ error: 'Доступ к проекту запрещен' }, { status: 403 });
    }
    const board = await ensureProjectBoard(projectId);
    const projectBoard = { ...board, projectTitle: project[0].title };
    return NextResponse.json({ boards: [projectBoard] });
  }

  const accessible = await getAccessibleBoards(auth);
  let list = accessible;

  if (kind === 'personal') {
    list = list.filter((b) => b.kind === 'personal');
  } else if (kind === 'project') {
    list = list.filter((b) => b.kind === 'project');
  }

  const allProjects = await db.select().from(projects);
  const projectMap = new Map(allProjects.map((p) => [p.id, p]));

  // Счётчик активных задач по каждой доске
  const counts: Record<string, number> = {};
  if (list.length > 0) {
    const taskRows = await db
      .select({ boardId: kanbanTasks.boardId })
      .from(kanbanTasks);
    for (const t of taskRows) {
      if (t.boardId) counts[t.boardId] = (counts[t.boardId] || 0) + 1;
    }
  }

  const enriched = list.map((b) => ({
    ...b,
    projectTitle: b.kind === 'project' && b.projectId ? projectMap.get(b.projectId)?.title || '' : '',
    tasksCount: counts[b.id] || 0,
  }));

  return NextResponse.json({ boards: enriched });
}

/** POST /api/kanban/boards — создать личную или проектную доску.
 * body: { title, projectId? } — projectId => проектная доска, иначе личная (владелец — текущий пользователь).
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!auth.canWriteKanban) {
    return NextResponse.json({ error: 'Forbidden: No kanban write permission' }, { status: 403 });
  }

  // Личные доски — только для пользовательских сессий/ключей с userId
  if (!auth.userId) {
    return NextResponse.json({ error: 'Нужен пользовательский аккаунт для личных досок' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const title = (body.title || '').trim();
    if (!title) {
      return NextResponse.json({ error: 'Название доски обязательно' }, { status: 400 });
    }

    const projectId = body.projectId || null;
    const kind = projectId ? 'project' : 'personal';

    if (projectId) {
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project || !isProjectAllowed(auth, projectId)) {
        return NextResponse.json({ error: 'Доступ к проекту запрещен' }, { status: 403 });
      }
      const [dupe] = await db
        .select()
        .from(kanbanBoards)
        .where(and(eq(kanbanBoards.projectId, projectId), eq(kanbanBoards.kind, 'project')))
        .limit(1);
      if (dupe) {
        return NextResponse.json({ error: 'У проекта уже есть доска' }, { status: 409 });
      }
    }

    const now = Date.now();
    const board = {
      id: `board_${nanoid(10)}`,
      kind,
      projectId: projectId || null,
      ownerId: kind === 'personal' ? auth.userId : null,
      title,
      position: 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(kanbanBoards).values(board);

    return NextResponse.json({ success: true, board });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка создания доски' }, { status: 500 });
  }
}
