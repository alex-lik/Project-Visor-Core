import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSessionToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Логин и пароль обязательны' }, { status: 400 });
    }

    const [user] = await db.select().from(users).where(eq(users.username, username.trim())).limit(1);
    if (!user) {
      return NextResponse.json({ error: 'Неверные учетные данные' }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Неверные учетные данные' }, { status: 401 });
    }

    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const cookieStore = await cookies();
    cookieStore.set('pv_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка авторизации' }, { status: 500 });
  }
}
