import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/db/init';
import { createSessionToken } from '@/lib/auth';
import { eq } from 'drizzle-orm';

/**
 * POST /api/auth/demo - 1-Click Demo Login for presentations, reviews, and client demos
 */
export async function POST(req: NextRequest) {
  await ensureDatabaseInitialized();

  try {
    // Find admin user or create if not exists
    let [adminUser] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);

    if (!adminUser) {
      // Re-run init to ensure admin user exists
      await ensureDatabaseInitialized();
      const [retryAdmin] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
      adminUser = retryAdmin;
    }

    if (!adminUser) {
      return NextResponse.json({ error: 'Демо-пользователь не найден' }, { status: 500 });
    }

    // Generate JWT session token
    const token = await createSessionToken({
      userId: adminUser.id,
      username: adminUser.username,
      role: adminUser.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
      },
    });

    // Set HTTP-only session cookie
    response.cookies.set('pv_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('[API /api/auth/demo] Error:', err);
    return NextResponse.json({ error: err.message || 'Ошибка входа в демо-режим' }, { status: 500 });
  }
}
