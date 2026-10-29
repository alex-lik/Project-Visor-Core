import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { kanbanBoards, kanbanTasks, projects, activityLogs } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { isBoardAllowed } from '@/lib/kanban-access';
import { eq, and, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';

async function loadBoard(id: string) {
  const [board] = await db.select().from(kanbanBoards).where(eq(kanbanBoards.id, id)).limit(1);
  return board;
}

function logActivity(auth: any, action: string, details: string) {
  return db.insert(activityLogs).values({
    id: `act_${nanoid(10)}`,
    actorType: 'user',
    actorName: auth.username || 'Пользователь',
    action,
    projectId: null,
    details,
    createdAt: Date.now(),
  });
}

/** PATCH /api/kanban/boards/{id}
 * body: { title?, position?, action? } где action:
 *  - 'move_to_personal': проектная доска целиком уезжает в личное пространство текущего пользователя
 *    (доступно владельцу проекта или админу; задачи открепляются от проекта);
 *  - 'move_to_project', projectId: личная доска переносится на проект
 *    (доступно тем, у кого есть право на запись в проект).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if ((auth as any).isDemo === true) {
    return NextResponse.json({ error: 'Демо-режим: изменение недоступно' }, { status: 403 });
  }

  const { id } = await params;
  const board = await loadBoard(id);
  if (!board) {
    return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
  }
  if (!isBoardAllowed(auth, board)) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }
  if (!auth.canWriteKanban) {
    return NextResponse.json({ error: 'Forbidden: No kanban write permission' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const updateData: any = { updatedAt: Date.now() };
    let movedInfo = '';

    if (body.title !== undefined && String(body.title).trim()) {
      updateData.title = String(body.title).trim();
    }
    if (body.position !== undefined) {
      updateData.position = Number(body.position) || 0;
    }

    if (body.action === 'move_to_personal') {
      if (board.kind !== 'project' || !board.projectId) {
        return NextResponse.json({ error: 'Доска уже личная' }, { status: 400 });
      }
      // Только владелец проекта или админ может «уйти с проектом» целиком в личное
      const [project] = await db.select().from(projects).where(eq(projects.id, board.projectId)).limit(1);
      const isProjectOwner = !!auth.userId && project?.ownerId === auth.userId;
      if (!auth.isAdmin && !isProjectOwner) {
        return NextResponse.json(
          { error: 'Перевести доску в личное пространство может владелец проекта или админ' },
          { status: 403 }
        );
      }
      if (!auth.userId) {
        return NextResponse.json({ error: 'Нужен пользовательский аккаунт' }, { status: 403 });
      }

      updateData.kind = 'personal';
      updateData.projectId = null;
      updateData.ownerId = auth.userId;

      // Задачи доски открепляются от проекта
      await db
        .update(kanbanTasks)
        .set({ projectId: null, updatedAt: Date.now() })
        .where(and(eq(kanbanTasks.boardId, board.id)));

      await logActivity(
        auth,
        'board_moved_to_personal',
        `Доска "${board.title}" перенесена из проекта "${project?.title || ''}" в личное пространство`
      );
      movedInfo = 'move_to_personal';
    } else if (body.action === 'move_to_project') {
      if (board.kind !== 'personal') {
        return NextResponse.json({ error: 'На проект можно перенести только личную доску' }, { status: 400 });
      }
      if (!board.ownerId) {
        return NextResponse.json({ error: 'Доска-сирота без владельца' }, { status: 400 });
      }
      if (!auth.isAdmin && auth.userId !== board.ownerId) {
        return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
      }

      const projectId = body.projectId;
      if (!projectId) {
        return NextResponse.json({ error: 'Укажите projectId целевого проекта' }, { status: 400 });
      }
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project || !isProjectAllowed(auth, projectId)) {
        return NextResponse.json({ error: 'Нет доступа к целевому проекту' }, { status: 403 });
      }
      if (!auth.canWriteKanban) {
        return NextResponse.json({ error: 'Нет права записи в целевой проект' }, { status: 403 });
      }
      const [dupe] = await db
        .select()
        .from(kanbanBoards)
        .where(and(eq(kanbanBoards.projectId, projectId), eq(kanbanBoards.kind, 'project')))
        .limit(1);
      if (dupe && dupe.id !== board.id) {
        // Пустая доска (например, лениво созданная после «скоректи это в личное») не блокирует перенос
        const [{ cnt } = { cnt: 0 } as any] = await db
          .select({ cnt: count() })
          .from(kanbanTasks)
          .where(eq(kanbanTasks.boardId, dupe.id));
        if (Number(cnt) > 0) {
          return NextResponse.json({ error: 'У целевого проекта уже есть доска с задачами' }, { status: 409 });
        }
        await db.delete(kanbanBoards).where(eq(kanbanBoards.id, dupe.id));
      }

      updateData.kind = 'project';
      updateData.projectId = projectId;
      updateData.ownerId = null;

      // Задачи доски становятся задачами целевого проекта
      await db
        .update(kanbanTasks)
        .set({ projectId, updatedAt: Date.now() })
        .where(eq(kanbanTasks.boardId, board.id));

      await logActivity(
        auth,
        'board_moved_to_project',
        `Личная доска "${board.title}" перенесена на проект "${project.title}"`
      );
      movedInfo = 'move_to_project';
    }

    await db.update(kanbanBoards).set(updateData).where(eq(kanbanBoards.id, id));
    const updated = await loadBoard(id);
    return NextResponse.json({ success: true, board: updated, action: movedInfo || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка обновления доски' }, { status: 500 });
  }
}

/** DELETE /api/kanban/boards/{id} — удалить личную доску (вместе с её задачами).
 * Проектные доски удалять нельзя — они входят в проект (удаляются каскадом вместе с проектом).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if ((auth as any).isDemo === true) {
    return NextResponse.json({ error: 'Демо-режим: удаление недоступно' }, { status: 403 });
  }
  if (!auth.canWriteKanban) {
    return NextResponse.json({ error: 'Forbidden: No kanban write permission' }, { status: 403 });
  }

  const { id } = await params;
  const board = await loadBoard(id);
  if (!board) {
    return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
  }
  if (board.kind !== 'personal') {
    return NextResponse.json(
      { error: 'Проектную доску нельзя удалить отдельно от проекта' },
      { status: 400 }
    );
  }
  if (!isBoardAllowed(auth, board)) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }
  if (!auth.isAdmin && auth.userId !== board.ownerId) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  try {
    // Задачи удаляются каскадом по FK board_id -> kanban_boards
    await db.delete(kanbanBoards).where(eq(kanbanBoards.id, id));
    await logActivity(auth, 'board_deleted', `Удалена личная доска "${board.title}"`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка удаления доски' }, { status: 500 });
  }
}
