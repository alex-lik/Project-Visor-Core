import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { hosts } from '@/db/schema';
import { authenticateRequest } from '@/lib/rbac';
import { listOpenCodeModels } from '@/lib/opencode';
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
    const result = await listOpenCodeModels(host);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ models: [], error: err.message }, { status: 200 });
  }
}
