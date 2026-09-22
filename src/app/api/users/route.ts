import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { authenticateRequest } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';
import { ensureDatabaseInitialized } from '@/db/init';
import { nanoid } from 'nanoid';
import { desc, eq } from 'drizzle-orm';

/**
 * GET /api/users - Returns list of users
 */
export async function GET(req: NextRequest) {
  await ensureDatabaseInitialized();
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));

  const safeUsers = allUsers.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email || null,
    role: u.role,
    createdAt: u.createdAt,
  }));

  return NextResponse.json({ users: safeUsers });
}

/**
 * POST /api/users - Create a new user (Admin only)
 */
export async function POST(req: NextRequest) {
  await ensureDatabaseInitialized();
  const auth = await authenticateRequest(req);

  // In Core, user creation requires admin authorization
  if (!auth || !auth.isAdmin) {
    return NextResponse.json(
      { error: 'Только администратор может создавать новых пользователей' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { username, password, email, role = 'viewer' } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Имя пользователя и пароль обязательны' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return NextResponse.json({ error: 'Логин должен содержать минимум 3 символа' }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, cleanUsername))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: 'Пользователь с таким именем уже существует' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const userId = `usr_${nanoid(10)}`;

    await db.insert(users).values({
      id: userId,
      username: cleanUsername,
      passwordHash,
      email: email?.trim() || null,
      role: role === 'admin' ? 'admin' : 'viewer',
      createdAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        username: cleanUsername,
        role,
        email: email?.trim() || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка создания пользователя' }, { status: 500 });
  }
}

/**
 * PATCH /api/users - Update user password or role (Admin only)
 */
export async function PATCH(req: NextRequest) {
  await ensureDatabaseInitialized();
  const auth = await authenticateRequest(req);
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, role, newPassword } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId обязателен' }, { status: 400 });
    }

    const updateData: Record<string, any> = {};

    if (role && (role === 'admin' || role === 'viewer')) {
      updateData.role = role;
    }

    if (newPassword && newPassword.length >= 6) {
      updateData.passwordHash = await hashPassword(newPassword);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Нет данных для обновления' }, { status: 400 });
    }

    await db.update(users).set(updateData).where(eq(users.id, userId));

    return NextResponse.json({ success: true, message: 'Пользователь успешно обновлен' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка обновления пользователя' }, { status: 500 });
  }
}

/**
 * DELETE /api/users - Delete user (Admin only)
 */
export async function DELETE(req: NextRequest) {
  await ensureDatabaseInitialized();
  const auth = await authenticateRequest(req);
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId обязателен' }, { status: 400 });
    }

    if (auth.userId === userId) {
      return NextResponse.json({ error: 'Нельзя удалить собственный аккаунт' }, { status: 400 });
    }

    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({ success: true, message: 'Пользователь удален' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка удаления пользователя' }, { status: 500 });
  }
}
