import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, projectMembers, users, activityLogs } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { canUserManageMembers } from '@/lib/project-access';
import { nanoid } from 'nanoid';
import { eq, and, or } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(or(eq(projects.id, id), eq(projects.slug, id)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
  }

  if (!isProjectAllowed(auth, project.id)) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  // Get project owner
  let owner = null;
  if (project.ownerId) {
    const [u] = await db
      .select({ id: users.id, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.id, project.ownerId))
      .limit(1);
    owner = u || null;
  }

  // Get project members
  const members = await db
    .select({
      id: projectMembers.id,
      userId: projectMembers.userId,
      role: projectMembers.role,
      createdAt: projectMembers.createdAt,
      username: users.username,
      userGlobalRole: users.role,
    })
    .from(projectMembers)
    .leftJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, project.id));

  const canManage = await canUserManageMembers(auth, project.id);

  return NextResponse.json({
    projectId: project.id,
    projectTitle: project.title,
    owner,
    members,
    canManage,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(or(eq(projects.id, id), eq(projects.slug, id)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
  }

  // Only project owner or system admin can grant access
  const canManage = await canUserManageMembers(auth, project.id);
  if (!canManage) {
    return NextResponse.json({ error: 'Только владелец проекта или администратор может предоставлять доступ' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, username, role = 'editor' } = body;

    let targetUserId = userId;
    let targetUsername = username;

    if (!targetUserId && targetUsername) {
      const [foundUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, targetUsername.trim().toLowerCase()))
        .limit(1);

      if (!foundUser) {
        return NextResponse.json({ error: `Пользователь "${targetUsername}" не найден` }, { status: 404 });
      }
      targetUserId = foundUser.id;
      targetUsername = foundUser.username;
    } else if (targetUserId && !targetUsername) {
      const [foundUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);
      if (foundUser) targetUsername = foundUser.username;
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'Укажите пользователя' }, { status: 400 });
    }

    if (project.ownerId === targetUserId) {
      return NextResponse.json({ error: 'Этот пользователь уже является владельцем проекта' }, { status: 400 });
    }

    // Check if membership already exists
    const [existingMember] = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, targetUserId)))
      .limit(1);

    if (existingMember) {
      // Update role
      await db
        .update(projectMembers)
        .set({ role })
        .where(eq(projectMembers.id, existingMember.id));
    } else {
      // Insert new membership
      await db.insert(projectMembers).values({
        id: `pm_${nanoid(10)}`,
        projectId: project.id,
        userId: targetUserId,
        role,
        createdAt: Date.now(),
      });
    }

    // Audit log
    await db.insert(activityLogs).values({
      id: `act_${nanoid(10)}`,
      actorType: 'user',
      actorName: auth.username || 'User',
      action: 'member_access_granted',
      projectId: project.id,
      details: `Пользователю "${targetUsername}" предоставлен доступ (${role})`,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      message: `Доступ для ${targetUsername} (${role}) успешно сохранен`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка предоставления доступа' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(or(eq(projects.id, id), eq(projects.slug, id)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
  }

  const canManage = await canUserManageMembers(auth, project.id);
  if (!canManage) {
    return NextResponse.json({ error: 'Только владелец проекта или администратор может отзывать доступ' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('userId');

  if (!targetUserId) {
    return NextResponse.json({ error: 'Не указан ID пользователя' }, { status: 400 });
  }

  await db
    .delete(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, targetUserId)));

  // Audit log
  await db.insert(activityLogs).values({
    id: `act_${nanoid(10)}`,
    actorType: 'user',
    actorName: auth.username || 'User',
    action: 'member_access_revoked',
    projectId: project.id,
    details: `Отозван доступ к проекту для пользователя ${targetUserId}`,
    createdAt: Date.now(),
  });

  return NextResponse.json({ success: true, message: 'Доступ успешно отозван' });
}
