import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { hosts, projects, deployments } from '@/db/schema';
import { authenticateRequest } from '@/lib/rbac';
import { normalizeContainers, extractPorts } from '@/lib/containers';
import { normalizeOpenCodePortInput } from '@/lib/opencode';
import { nanoid } from 'nanoid';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!auth.isAdmin && !auth.canViewInfra) {
    return NextResponse.json({ error: 'Forbidden: Infrastructure access not granted' }, { status: 403 });
  }

  const allHosts = await db.select().from(hosts).orderBy(desc(hosts.updatedAt));
  const allProjects = await db.select().from(projects);
  const allDeployments = await db.select().from(deployments);

  const enriched = allHosts.map((h) => {
    const hostedProjects = allProjects
      .filter((p) => p.hostId === h.id)
      .map((p) => {
        const dep = allDeployments.find((d) => d.projectId === p.id);
        const containers = normalizeContainers(dep);
        const allPorts = extractPorts(containers);
        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          category: p.category,
          status: p.status,
          runtimeType: dep?.runtimeType || 'unknown',
          port: dep?.internalPort || (allPorts[0]?.port ?? null),
          ports: allPorts.map((ap) => ap.port),
          containers,
          deployAutomation: dep?.deployAutomation || 'manual_ssh',
          containerName: dep?.containerName || null,
        };
      });

    // Check for duplicate port conflicts on this host across all containers!
    const allHostPorts: number[] = [];
    hostedProjects.forEach((p) => {
      if (p.ports && p.ports.length > 0) {
        allHostPorts.push(...p.ports);
      } else if (p.port) {
        allHostPorts.push(p.port);
      }
    });
    const duplicatePorts = allHostPorts.filter((item, index) => allHostPorts.indexOf(item) !== index);

    return {
      ...h,
      projectsCount: hostedProjects.length,
      hostedProjects,
      hasPortConflict: duplicatePorts.length > 0,
      conflictedPorts: Array.from(new Set(duplicatePorts)),
    };
  });

  return NextResponse.json({
    total: enriched.length,
    hosts: enriched,
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, ipAddress, sshAlias, sshUser = 'root', sshPort = 22, provider, osType = 'Ubuntu 24.04', specs, prometheusJob, notes } = body;

    if (!name) {
      return NextResponse.json({ error: 'Имя сервера обязательно' }, { status: 400 });
    }

    const hostId = `host_${nanoid(10)}`;
    await db.insert(hosts).values({
      id: hostId,
      name,
      ipAddress: ipAddress || null,
      sshAlias: sshAlias || null,
      sshUser: sshUser || 'root',
      sshPort: sshPort ? Number(sshPort) : 22,
      provider: provider || 'VPS',
      osType: osType || 'Ubuntu 24.04',
      specs: specs || null,
      prometheusJob: prometheusJob || null,
      status: 'online',
      notes: notes || '',
      opencodeEnabled: body.opencodeEnabled ? 1 : 0,
      opencodeHost: body.opencodeHost ? String(body.opencodeHost).trim() || null : null,
      // Порт опционален: пусто → null (авто-режим: 443/80 + legacy 4096 при discovery).
      opencodePort: normalizeOpenCodePortInput(body.opencodePort),
      // Resolved scheme from auto-discovery (frontend присылает detectedUseHttps);
      // ручной галки HTTPS больше нет.
      opencodeUseHttps: body.opencodeUseHttps ? 1 : 0,
      opencodeUsername: body.opencodeUsername || 'opencode',
      opencodePassword: body.opencodePassword || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return NextResponse.json({ success: true, hostId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка добавления хоста' }, { status: 500 });
  }
}
