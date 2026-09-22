import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { metricTargets, projects, hosts } from '@/db/schema';
import { authenticateRequest } from '@/lib/rbac';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const targets = await db.select().from(metricTargets);
  const allProjects = await db.select().from(projects);
  const allHosts = await db.select().from(hosts);

  const enriched = targets.map((t) => {
    const p = t.projectId ? allProjects.find((proj) => proj.id === t.projectId) : null;
    const h = t.hostId ? allHosts.find((host) => host.id === t.hostId) : null;
    return {
      ...t,
      projectName: p?.title || null,
      hostName: h?.name || null,
    };
  });

  return NextResponse.json({ targets: enriched });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, checkType = 'http_ping', target, projectId, hostId } = body;

    if (!name || !target) {
      return NextResponse.json({ error: 'Имя и цель (target) обязательны' }, { status: 400 });
    }

    const id = `target_${nanoid(10)}`;
    await db.insert(metricTargets).values({
      id,
      name,
      checkType,
      target,
      projectId: projectId || null,
      hostId: hostId || null,
      lastStatus: 'unknown',
      lastResponseTimeMs: null,
      lastValue: null,
      lastCheckedAt: null,
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка добавления цели мониторинга' }, { status: 500 });
  }
}
