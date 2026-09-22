import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiKeys } from '@/db/schema';
import { authenticateRequest } from '@/lib/rbac';
import { eq } from 'drizzle-orm';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [keyRecord] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);

  if (!keyRecord) {
    return NextResponse.json({ error: 'Ключ не найден' }, { status: 404 });
  }

  if (!auth.isAdmin && keyRecord.userId !== auth.userId) {
    return NextResponse.json({ error: 'У вас нет прав на удаление этого ключа' }, { status: 403 });
  }

  await db.delete(apiKeys).where(eq(apiKeys.id, id));
  return NextResponse.json({ success: true, message: 'API ключ отозван' });
}
