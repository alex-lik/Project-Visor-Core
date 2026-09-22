import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { apiKeys, projects, users } from '@/db/schema';
import { authenticateRequest, generateApiKey } from '@/lib/rbac';
import { nanoid } from 'nanoid';
import { desc, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const showAll = searchParams.get('all') === 'true' && auth.isAdmin;

  let query = db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  let allKeys = await query;

  if (!showAll && auth.userId) {
    allKeys = allKeys.filter((k) => k.userId === auth.userId || (!k.userId && auth.isAdmin));
  }

  const allProjects = await db.select().from(projects);
  const allUsers = await db.select({ id: users.id, username: users.username }).from(users);

  const enriched = allKeys.map((k) => {
    let allowedIds: string[] = [];
    try {
      allowedIds = JSON.parse(k.allowedProjectIds || '[]');
    } catch {
      allowedIds = [];
    }

    const projectNames = allowedIds.map((id) => allProjects.find((p) => p.id === id)?.title || id);
    const owner = allUsers.find((u) => u.id === k.userId);

    return {
      id: k.id,
      name: k.name,
      userId: k.userId,
      ownerUsername: owner?.username || (k.userId ? 'Unknown' : 'System Admin'),
      isMyKey: k.userId === auth.userId,
      keyPrefix: k.keyPrefix,
      roleScope: k.roleScope,
      allowedProjectIds: allowedIds,
      allowedProjectNames: projectNames,
      canWriteKanban: Boolean(k.canWriteKanban),
      canUpdateStatus: Boolean(k.canUpdateStatus),
      canViewInfra: Boolean(k.canViewInfra),
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
    };
  });

  return NextResponse.json({ keys: enriched });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      name,
      roleScope = 'all_projects',
      allowedProjectIds = [],
      canWriteKanban = true,
      canUpdateStatus = true,
      canViewInfra = false,
      expiresInDays,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Имя ключа обязательно' }, { status: 400 });
    }

    // If user is not admin, ensure they can only grant access to their accessible projects
    let finalAllowedIds: string[] = allowedProjectIds || [];
    if (!auth.isAdmin && roleScope === 'scoped_projects') {
      finalAllowedIds = finalAllowedIds.filter((id) => auth.allowedProjectIds.includes(id));
      if (finalAllowedIds.length === 0) {
        return NextResponse.json({ error: 'Выберите хотя бы один доступный вам проект' }, { status: 400 });
      }
    }

    const { rawKey, keyPrefix, keyHash } = generateApiKey();
    const keyId = `key_${nanoid(10)}`;
    const expiresAt = expiresInDays ? Date.now() + expiresInDays * 24 * 60 * 60 * 1000 : null;

    await db.insert(apiKeys).values({
      id: keyId,
      userId: auth.userId || 'usr_admin',
      name,
      keyPrefix: `${keyPrefix}...`,
      keyHash,
      roleScope,
      allowedProjectIds: JSON.stringify(finalAllowedIds),
      canWriteKanban: canWriteKanban ? 1 : 0,
      canUpdateStatus: canUpdateStatus ? 1 : 0,
      canViewInfra: canViewInfra ? 1 : 0,
      createdAt: Date.now(),
      lastUsedAt: null,
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      keyId,
      name,
      rawKey, // returned ONLY once to the user!
      keyPrefix,
      message: 'API ключ успешно создан. Сохраните его сейчас — он больше не будет показан!',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка создания ключа' }, { status: 500 });
  }
}

