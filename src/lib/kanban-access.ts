import { db } from '@/db';
import { kanbanBoards, kanbanTasks, projects } from '@/db/schema';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { AuthContext } from '@/lib/rbac';
import { isProjectAllowed } from '@/lib/rbac';

export type BoardRow = typeof kanbanBoards.$inferSelect;

/**
 * Единая проектная доска проекта: лениво создаётся при первом обращении,
 * также подвязывает legacy-задачи проекта, у которых не заполнен board_id.
 */
export async function ensureProjectBoard(projectId: string): Promise<BoardRow> {
  const [existing] = await db
    .select()
    .from(kanbanBoards)
    .where(and(eq(kanbanBoards.projectId, projectId), eq(kanbanBoards.kind, 'project')))
    .limit(1);
  if (existing) return existing;

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  const now = Date.now();
  const board = {
    id: `board_${nanoid(10)}`,
    kind: 'project' as const,
    projectId,
    ownerId: null,
    title: project ? `Доска: ${project.title}` : 'Доска проекта',
    position: 0,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.insert(kanbanBoards).values(board);
  } catch {
    // Возможен race-дубль при параллельных запросах — перечитываем
    const [again] = await db
      .select()
      .from(kanbanBoards)
      .where(and(eq(kanbanBoards.projectId, projectId), eq(kanbanBoards.kind, 'project')))
      .limit(1);
    if (again) return again;
    throw new Error('Не удалось создать проектную доску');
  }

  try {
    await db
      .update(kanbanTasks)
      .set({ boardId: board.id })
      .where(and(eq(kanbanTasks.projectId, projectId), isNull(kanbanTasks.boardId)));
  } catch {
    // non-critical
  }
  return board;
}

/** Личная доска видна только владельцу и админам; проектная доска — по доступу к проекту. */
export function isBoardAllowed(auth: AuthContext, board: BoardRow | null | undefined): boolean {
  if (!board) return false;
  if (board.kind === 'personal') {
    if (!auth) return false;
    return auth.isAdmin || (!!auth.userId && board.ownerId === auth.userId);
  }
  return !!board.projectId && isProjectAllowed(auth, board.projectId);
}

/** Проверка доступа к задаче через её доску (с fallback на legacy-поведение по проекту). */
export async function isTaskAllowed(
  auth: AuthContext,
  task: { boardId?: string | null; projectId?: string | null }
): Promise<boolean> {
  if (task.boardId) {
    const [board] = await db.select().from(kanbanBoards).where(eq(kanbanBoards.id, task.boardId)).limit(1);
    if (board) return isBoardAllowed(auth, board);
    // Доска удалена — проверяем хотя бы проект, иначе задача «осиротела» зря
    return !!task.projectId && isProjectAllowed(auth, task.projectId);
  }
  return !!task.projectId && isProjectAllowed(auth, task.projectId);
}

/** Все доски, доступные текущему контексту (проектные по RBAC + свои личные). */
export async function getAccessibleBoards(auth: AuthContext): Promise<BoardRow[]> {
  const all = await db.select().from(kanbanBoards).orderBy(asc(kanbanBoards.position), desc(kanbanBoards.createdAt));
  return all.filter((b) => isBoardAllowed(auth, b));
}
