import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { hosts } from '@/db/schema';
import { authenticateRequest } from '@/lib/rbac';
import { listOpenCodeSessions, createOpenCodeSession } from '@/lib/opencode';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [host] = await db.select().from(hosts).where(eq(hosts.id, id)).limit(1);

  if (!host) {
    return NextResponse.json({ error: 'Host not found' }, { status: 404 });
  }

  try {
    const sessions = await listOpenCodeSessions(host);
    return NextResponse.json({ sessions });
  } catch (err: any) {
    return NextResponse.json({ sessions: [], error: err.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [host] = await db.select().from(hosts).where(eq(hosts.id, id)).limit(1);

  if (!host) {
    return NextResponse.json({ error: 'Host not found' }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { title, directory } = body;
    const session = await createOpenCodeSession(host, title, directory);
    return NextResponse.json({ session });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create session' }, { status: 500 });
  }
}
