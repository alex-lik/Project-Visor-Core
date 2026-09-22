import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { ensureDatabaseInitialized } from '@/db/init';
import { createSessionToken, hashPassword } from '@/lib/auth';
import { eq } from 'drizzle-orm';

/**
 * POST /api/auth/demo - 1-Click Demo Login for presentations, reviews, and client demos
 * Security (V-01):
 * - Disabled in production unless ENABLE_DEMO_LOGIN=true is set
 * - Always issues a session with role: 'viewer', NEVER admin
 */
export async function POST(req: NextRequest) {
  await ensureDatabaseInitialized();

  // 1. Environment Gate: block in production unless explicitly permitted
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEMO_LOGIN !== 'true') {
    return NextResponse.json(
      { error: 'Демо-режим отключен в производственной среде' },
      { status: 403 }
    );
  }

  try {
    // 2. Find or create a dedicated restricted demo user with role 'viewer'
    let [demoUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, 'demo_viewer'))
      .limit(1);

    if (!demoUser) {
      const passwordHash = await hashPassword('demo_restricted_' + Date.now());
      const demoUserId = 'usr_demo_viewer';
      try {
        await db.insert(users).values({
          id: demoUserId,
          username: 'demo_viewer',
          passwordHash,
          role: 'viewer',
          createdAt: Date.now(),
        });
      } catch {
        // User may have been inserted concurrently
      }

      const [created] = await db
        .select()
        .from(users)
        .where(eq(users.username, 'demo_viewer'))
        .limit(1);
      demoUser = created;
    }

    if (!demoUser) {
      return NextResponse.json({ error: 'Демо-пользователь не найден' }, { status: 500 });
    }

    // 3. Generate JWT session token with viewer role
    const token = await createSessionToken({
      userId: demoUser.id,
      username: demoUser.username,
      role: 'viewer',
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: demoUser.id,
        username: demoUser.username,
        role: 'viewer',
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
