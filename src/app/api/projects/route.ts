import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, hosts, deployments, kanbanTasks, activityLogs, users } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { normalizeContainers } from '@/lib/containers';
import { nanoid } from 'nanoid';
import { desc, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status');
  const categoryFilter = searchParams.get('category');
  const searchQuery = searchParams.get('q')?.toLowerCase();

  const allProjects = await db.select().from(projects).orderBy(desc(projects.updatedAt));
  const allHosts = await db.select().from(hosts);
  const allDeployments = await db.select().from(deployments);
  const allTasks = await db.select().from(kanbanTasks);
  const allUsers = await db.select({ id: users.id, username: users.username }).from(users);

  const filtered = allProjects
    .filter((p) => isProjectAllowed(auth, p.id))
    .filter((p) => !statusFilter || p.status === statusFilter)
    .filter((p) => !categoryFilter || p.category === categoryFilter)
    .filter((p) => {
      if (!searchQuery) return true;
      return (
        p.title.toLowerCase().includes(searchQuery) ||
        (p.description && p.description.toLowerCase().includes(searchQuery)) ||
        p.slug.toLowerCase().includes(searchQuery)
      );
    });

  const enriched = filtered.map((p) => {
    const host = allHosts.find((h) => h.id === p.hostId);
    const deploy = allDeployments.find((d) => d.projectId === p.id);
    const pTasks = allTasks.filter((t) => t.projectId === p.id);
    const owner = allUsers.find((u) => u.id === p.ownerId);

    return {
      ...p,
      tags: JSON.parse(p.tags || '[]'),
      host: host ? { id: host.id, name: host.name, ip: host.ipAddress } : null,
      owner: owner ? { id: owner.id, username: owner.username } : null,
      isOwner: auth.isAdmin || p.ownerId === auth.userId,
      deployment: deploy ? { ...deploy, containers: normalizeContainers(deploy) } : null,
      taskStats: {
        total: pTasks.length,
        inProgress: pTasks.filter((t) => t.column === 'in_progress').length,
        todo: pTasks.filter((t) => t.column === 'todo').length,
        done: pTasks.filter((t) => t.column === 'done').length,
      },
    };
  });

  return NextResponse.json({
    total: enriched.length,
    projects: enriched,
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      title,
      slug,
      description,
      category = 'website',
      status = 'idea',
      priority = 'medium',
      repoUrl,
      publicUrl,
      docUrl,
      hostId,
      tags = [],
      readmeNotes,
      deployment,
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'Название проекта обязательно' }, { status: 400 });
    }

    const baseSlug = slug
      ? slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
      : title.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    const finalSlug = baseSlug || `proj-${nanoid(6)}`;
    const projectId = `proj_${nanoid(10)}`;

    await db.insert(projects).values({
      id: projectId,
      slug: finalSlug,
      title,
      description: description || '',
      category,
      status,
      priority,
      repoUrl: repoUrl || null,
      publicUrl: publicUrl || null,
      docUrl: docUrl || null,
      hostId: hostId || null,
      ownerId: auth.userId || 'usr_admin',
      tags: JSON.stringify(tags || []),
      readmeNotes: readmeNotes || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create deployment info if provided
    if (deployment) {
      let rawContainers: any[] = [];
      if (deployment.containers) {
        if (typeof deployment.containers === 'string') {
          try {
            rawContainers = JSON.parse(deployment.containers);
          } catch {
            rawContainers = [];
          }
        } else if (Array.isArray(deployment.containers)) {
          rawContainers = deployment.containers;
        }
      }

      let primaryPort = deployment.internalPort ? Number(deployment.internalPort) : null;
      let primaryContainerName = deployment.containerName || null;

      if (rawContainers.length > 0) {
        const firstWithPort = rawContainers.find((c: any) => c.port && Number(c.port) > 0);
        if (firstWithPort && !primaryPort) {
          primaryPort = Number(firstWithPort.port);
        }
        const firstWithName = rawContainers.find((c: any) => c.containerName || c.name);
        if (firstWithName && !primaryContainerName) {
          primaryContainerName = firstWithName.containerName || firstWithName.name;
        }
      } else if (primaryPort || primaryContainerName) {
        rawContainers = [
          {
            id: `c_${nanoid(6)}`,
            name: deployment.serviceName || primaryContainerName || 'default',
            type: 'web',
            containerName: primaryContainerName,
            port: primaryPort,
            portType: 'http',
            isPublic: true,
          },
        ];
      }

      await db.insert(deployments).values({
        id: `dep_${nanoid(10)}`,
        projectId,
        runtimeType: deployment.runtimeType || 'docker_compose',
        deployAutomation: deployment.deployAutomation || 'manual_ssh',
        internalPort: primaryPort,
        containerName: primaryContainerName,
        serviceName: deployment.serviceName || null,
        containers: JSON.stringify(rawContainers),
        deployPath: deployment.deployPath || null,
        deployCommand: deployment.deployCommand || null,
        healthEndpoint: deployment.healthEndpoint || null,
        envKeysHint: deployment.envKeysHint || null,
        secretsType: deployment.secretsType || 'dotenv',
        secretsPathOrUri: deployment.secretsPathOrUri || null,
        notes: deployment.notes || null,
        backupEnabled: deployment.backupEnabled ? 1 : 0,
        backupSchedule: deployment.backupSchedule || null,
        backupTool: deployment.backupTool || null,
        backupDestination: deployment.backupDestination || null,
        storageProvider: deployment.storageProvider || null,
        storageBucket: deployment.storageBucket || null,
        storageEndpoint: deployment.storageEndpoint || null,
        ftpHost: deployment.ftpHost || null,
        ftpPort: deployment.ftpPort ? Number(deployment.ftpPort) : 22,
        ftpUser: deployment.ftpUser || null,
        ftpPath: deployment.ftpPath || null,
        sentryProject: deployment.sentryProject || null,
        updatedAt: Date.now(),
      });
    }

    // Log activity
    await db.insert(activityLogs).values({
      id: `act_${nanoid(10)}`,
      actorType: auth.isUser ? 'user' : 'agent',
      actorName: auth.isUser ? 'Admin' : auth.keyName || 'Agent',
      action: 'project_created',
      projectId,
      details: `Создан проект "${title}" (Статус: ${status})`,
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true, projectId, slug: finalSlug });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка создания проекта' }, { status: 500 });
  }
}
