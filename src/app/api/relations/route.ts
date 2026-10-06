import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, projectRelations, hosts } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { RELATION_LABELS } from '@/lib/utils';
import { getAllowedRelationTypeKeys, getRelationTypesOwner } from '@/lib/relation-types';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allProjects = await db.select().from(projects);
  const allHosts = await db.select().from(hosts);
  const allRelations = await db.select().from(projectRelations);

  // Filter accessible projects
  const allowedProjects = allProjects.filter((p) => isProjectAllowed(auth, p.id));
  const allowedIds = new Set(allowedProjects.map((p) => p.id));

  // Graph nodes
  const nodes = allowedProjects.map((p) => {
    const host = allHosts.find((h) => h.id === p.hostId);
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      status: p.status,
      priority: p.priority,
      hostId: host?.id || null,
      hostName: host?.name || null,
    };
  });

  // Hosts referenced by visible projects (for optional host layer on the graph)
  const usedHostIds = new Set(
    allowedProjects.map((p) => p.hostId).filter((id): id is string => Boolean(id))
  );
  const visibleHosts = allHosts
    .filter((h) => usedHostIds.has(h.id))
    .map((h) => ({
      id: h.id,
      name: h.name,
      ipAddress: h.ipAddress || null,
      provider: h.provider || null,
      status: h.status || 'unknown',
    }));

  // Graph edges
  const edges = allRelations
    .filter((r) => allowedIds.has(r.sourceProjectId) && allowedIds.has(r.targetProjectId))
    .map((r) => {
      const meta = RELATION_LABELS[r.relationType] || { label: r.relationType, color: '#94a3b8' };
      return {
        id: r.id,
        source: r.sourceProjectId,
        target: r.targetProjectId,
        relationType: r.relationType,
        label: meta.label,
        color: meta.color,
        description: r.description,
      };
    });

  return NextResponse.json({ nodes, edges, hosts: visibleHosts });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { sourceProjectId, targetProjectId, relationType = 'depends_on', description } = body;

    if (!sourceProjectId || !targetProjectId) {
      return NextResponse.json({ error: 'Source и Target проекты обязательны' }, { status: 400 });
    }

    if (sourceProjectId === targetProjectId) {
      return NextResponse.json({ error: 'Проект не может ссылаться сам на себя' }, { status: 400 });
    }

    if (!isProjectAllowed(auth, sourceProjectId) || !isProjectAllowed(auth, targetProjectId)) {
      return NextResponse.json({ error: 'Доступ к одному из проектов запрещен' }, { status: 403 });
    }

    const allowedTypes = await getAllowedRelationTypeKeys(getRelationTypesOwner(auth));
    if (!allowedTypes.has(relationType)) {
      return NextResponse.json({ error: 'Неизвестный тип связи' }, { status: 400 });
    }

    const relationId = `rel_${nanoid(10)}`;
    await db.insert(projectRelations).values({
      id: relationId,
      sourceProjectId,
      targetProjectId,
      relationType,
      description: description || null,
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true, relationId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка создания связи' }, { status: 500 });
  }
}



export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, sourceProjectId, targetProjectId, relationType, description } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID связи обязателен' }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(projectRelations)
      .where(eq(projectRelations.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'Связь не найдена' }, { status: 404 });
    }

    if (
      !isProjectAllowed(auth, existing.sourceProjectId) ||
      !isProjectAllowed(auth, existing.targetProjectId)
    ) {
      return NextResponse.json({ error: 'Доступ к связи запрещен' }, { status: 403 });
    }

    const nextSource = sourceProjectId || existing.sourceProjectId;
    const nextTarget = targetProjectId || existing.targetProjectId;
    const nextType = relationType || existing.relationType;

    if (nextSource === nextTarget) {
      return NextResponse.json({ error: 'Проект не может ссылаться сам на себя' }, { status: 400 });
    }

    const allowedTypes = await getAllowedRelationTypeKeys(getRelationTypesOwner(auth));
    if (!allowedTypes.has(nextType)) {
      return NextResponse.json({ error: 'Неизвестный тип связи' }, { status: 400 });
    }

    if (!isProjectAllowed(auth, nextSource) || !isProjectAllowed(auth, nextTarget)) {
      return NextResponse.json({ error: 'Доступ к одному из проектов запрещен' }, { status: 403 });
    }

    await db
      .update(projectRelations)
      .set({
        sourceProjectId: nextSource,
        targetProjectId: nextTarget,
        relationType: nextType,
        description: description !== undefined ? description || null : existing.description,
      })
      .where(eq(projectRelations.id, id));

    return NextResponse.json({ success: true, relationId: id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка обновления связи' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID связи обязателен' }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(projectRelations)
    .where(eq(projectRelations.id, id))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: 'Связь не найдена' }, { status: 404 });
  }

  if (
    !isProjectAllowed(auth, existing.sourceProjectId) ||
    !isProjectAllowed(auth, existing.targetProjectId)
  ) {
    return NextResponse.json({ error: 'Доступ к связи запрещен' }, { status: 403 });
  }

  await db.delete(projectRelations).where(eq(projectRelations.id, id));
  return NextResponse.json({ success: true });
}
