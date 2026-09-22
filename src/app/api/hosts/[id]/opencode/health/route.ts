import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { hosts } from '@/db/schema';
import { authenticateRequest } from '@/lib/rbac';
import { checkOpenCodeHealth, normalizeOpenCodePortInput } from '@/lib/opencode';
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

  const result = await checkOpenCodeHealth(host);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await checkOpenCodeHealth({
      opencodeHost: body.opencodeHost ?? null,
      ipAddress: body.ipAddress ?? null,
      opencodePort: normalizeOpenCodePortInput(body.opencodePort),
      opencodeUsername: body.opencodeUsername ?? null,
      opencodePassword: body.opencodePassword ?? null,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ healthy: false, error: err.message }, { status: 400 });
  }
}
