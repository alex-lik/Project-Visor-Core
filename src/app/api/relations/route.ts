import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, projectRelations, hosts } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { RELATION_LABELS } from '@/lib/utils';

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
      hostName: host?.name || null,
    };
  });

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

  return NextResponse.json({ nodes, edges });
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

  await db.delete(projectRelations).where(eq(projectRelations.id, id));
  return NextResponse.json({ success: true });
}
