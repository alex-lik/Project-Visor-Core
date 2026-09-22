import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { hosts, projects, metricTargets, opencodeRuns } from '@/db/schema';
import { authenticateRequest } from '@/lib/rbac';
import { ensureDatabaseInitialized } from '@/db/init';
import { normalizeOpenCodePortInput } from '@/lib/opencode';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDatabaseInitialized();
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!auth.isAdmin && !auth.canViewInfra) {
    return NextResponse.json({ error: 'Forbidden: Infrastructure access not granted' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const [host] = await db.select().from(hosts).where(eq(hosts.id, id)).limit(1);
    if (!host) {
      return NextResponse.json({ error: 'Хост не найден' }, { status: 404 });
    }

    const hostedProjects = await db.select().from(projects).where(eq(projects.hostId, host.id));
    return NextResponse.json({ ...host, hostedProjects });
  } catch (err: any) {
    console.error(`[API /api/hosts/${id} GET] Error:`, err);
    return NextResponse.json({ error: err.message || 'Ошибка получения хоста' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDatabaseInitialized();
  const auth = await authenticateRequest(req);
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const updateData: any = { updatedAt: Date.now() };

    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.ipAddress !== undefined) updateData.ipAddress = body.ipAddress ? String(body.ipAddress).trim() : null;
    if (body.sshAlias !== undefined) updateData.sshAlias = body.sshAlias ? String(body.sshAlias).trim() : null;
    if (body.sshUser !== undefined) updateData.sshUser = body.sshUser ? String(body.sshUser).trim() : 'root';
    if (body.sshPort !== undefined) {
      const p = Number(body.sshPort);
      updateData.sshPort = Number.isFinite(p) && p > 0 ? p : 22;
    }
    if (body.provider !== undefined) updateData.provider = body.provider ? String(body.provider).trim() : 'VPS';
    if (body.osType !== undefined) updateData.osType = body.osType ? String(body.osType).trim() : 'Ubuntu 24.04';
    if (body.specs !== undefined) updateData.specs = body.specs ? String(body.specs).trim() : null;
    if (body.prometheusJob !== undefined) updateData.prometheusJob = body.prometheusJob ? String(body.prometheusJob).trim() : null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.opencodeEnabled !== undefined) updateData.opencodeEnabled = body.opencodeEnabled ? 1 : 0;
    if (body.opencodeHost !== undefined) updateData.opencodeHost = body.opencodeHost ? String(body.opencodeHost).trim() || null : null;
    if (body.opencodePort !== undefined) {
      // Порт опционален: пусто → null (авто-режим), число → явный порт.
      updateData.opencodePort = normalizeOpenCodePortInput(body.opencodePort);
    }
    if (body.opencodeUseHttps !== undefined) updateData.opencodeUseHttps = body.opencodeUseHttps ? 1 : 0;
    if (body.opencodeUsername !== undefined) updateData.opencodeUsername = body.opencodeUsername ? String(body.opencodeUsername).trim() : 'opencode';
    if (body.opencodePassword !== undefined) updateData.opencodePassword = body.opencodePassword ? String(body.opencodePassword) : null;

    await db.update(hosts).set(updateData).where(eq(hosts.id, id));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[API /api/hosts/${id} PATCH] Error:`, err);
    return NextResponse.json({ error: err.message || 'Ошибка обновления' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDatabaseInitialized();
  const auth = await authenticateRequest(req);
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true';

    // Check for linked projects: projects.hostId -> hosts.id has no ON DELETE CASCADE,
    // so a plain delete throws FOREIGN KEY constraint failed (500 without this guard).
    const linkedProjects = await db
      .select({ id: projects.id, title: projects.title })
      .from(projects)
      .where(eq(projects.hostId, id));

    if (linkedProjects.length > 0 && !force) {
      return NextResponse.json(
        {
          error: `На сервере ${linkedProjects.length} проект(а/ов). Сначала отвяжите их или удалите с флагом force.`,
          projectsCount: linkedProjects.length,
          projectTitles: linkedProjects.map((p) => p.title),
        },
        { status: 409 }
      );
    }

    if (linkedProjects.length > 0 && force) {
      // Detach projects instead of cascade-deleting them
      await db.update(projects).set({ hostId: null }).where(eq(projects.hostId, id));
    }

    // Clean up or detach metric targets and opencode runs linked to this host
    await db.delete(metricTargets).where(eq(metricTargets.hostId, id));
    await db.delete(opencodeRuns).where(eq(opencodeRuns.hostId, id));

    await db.delete(hosts).where(eq(hosts.id, id));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[API /api/hosts/${id} DELETE] Error:`, err);
    return NextResponse.json({ error: err.message || 'Ошибка удаления хоста' }, { status: 500 });
  }
}
