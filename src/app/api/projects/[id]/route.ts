import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, hosts, deployments, projectRelations, kanbanTasks, metricTargets, activityLogs, users } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { getUserProjectRole, canUserEditProject, canUserManageMembers } from '@/lib/project-access';
import { dispatchNotification } from '@/lib/notifications';
import { normalizeContainers } from '@/lib/containers';
import { eq, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(or(eq(projects.id, id), eq(projects.slug, id)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
  }

  if (!isProjectAllowed(auth, project.id)) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  // Load associated data
  const host = project.hostId
    ? (await db.select().from(hosts).where(eq(hosts.id, project.hostId)).limit(1))[0]
    : null;

  const [deployment] = await db
    .select()
    .from(deployments)
    .where(eq(deployments.projectId, project.id))
    .limit(1);

  const outgoing = await db
    .select()
    .from(projectRelations)
    .where(eq(projectRelations.sourceProjectId, project.id));

  const incoming = await db
    .select()
    .from(projectRelations)
    .where(eq(projectRelations.targetProjectId, project.id));

  const tasks = await db
    .select()
    .from(kanbanTasks)
    .where(eq(kanbanTasks.projectId, project.id));

  const targets = await db
    .select()
    .from(metricTargets)
    .where(eq(metricTargets.projectId, project.id));

  const allProjects = await db.select().from(projects);

  const enrichedOutgoing = outgoing.map((r) => {
    const target = allProjects.find((p) => p.id === r.targetProjectId);
    return {
      ...r,
      targetProjectTitle: target?.title || 'Unknown',
      targetProjectCategory: target?.category || 'system',
    };
  });

  const enrichedIncoming = incoming.map((r) => {
    const source = allProjects.find((p) => p.id === r.sourceProjectId);
    return {
      ...r,
      sourceProjectTitle: source?.title || 'Unknown',
      sourceProjectCategory: source?.category || 'system',
    };
  });

  let owner = null;
  if (project.ownerId) {
    const [u] = await db
      .select({ id: users.id, username: users.username, role: users.role })
      .from(users)
      .where(eq(users.id, project.ownerId))
      .limit(1);
    owner = u || null;
  }

  const userRole = auth.isAdmin
    ? 'admin'
    : auth.userId
    ? await getUserProjectRole(auth.userId, project.id)
    : null;

  const canEdit = await canUserEditProject(auth, project.id);
  const canManageMembers = await canUserManageMembers(auth, project.id);

  return NextResponse.json({
    ...project,
    tags: JSON.parse(project.tags || '[]'),
    host: host || null,
    owner,
    isOwner: auth.isAdmin || project.ownerId === auth.userId,
    userRole,
    canEdit,
    canManageMembers,
    deployment: deployment ? { ...deployment, containers: normalizeContainers(deployment) } : null,
    relations: {
      outgoing: enrichedOutgoing,
      incoming: enrichedIncoming,
    },
    tasks,
    metricTargets: targets,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(or(eq(projects.id, id), eq(projects.slug, id)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
  }

  if (!isProjectAllowed(auth, project.id)) {
    return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
  }

  const canEdit = await canUserEditProject(auth, project.id);
  if (!canEdit) {
    return NextResponse.json({ error: 'У вас нет прав на редактирование этого проекта' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const updateData: any = { updatedAt: Date.now() };

    if (body.title) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category) updateData.category = body.category;
    if (body.priority) updateData.priority = body.priority;
    if (body.repoUrl !== undefined) updateData.repoUrl = body.repoUrl;
    if (body.publicUrl !== undefined) updateData.publicUrl = body.publicUrl;
    if (body.docUrl !== undefined) updateData.docUrl = body.docUrl;
    if (body.hostId !== undefined) {
      const nextHostId = body.hostId || null;
      if (nextHostId !== project.hostId) {
        if (nextHostId) {
          const [targetHost] = await db.select().from(hosts).where(eq(hosts.id, nextHostId)).limit(1);
          if (!targetHost) {
            return NextResponse.json({ error: 'Целевой сервер не найден' }, { status: 404 });
          }
        }
        updateData.hostId = nextHostId;
      }
    }
    if (body.tags) updateData.tags = JSON.stringify(body.tags);
    if (body.readmeNotes !== undefined) updateData.readmeNotes = body.readmeNotes;

    // Status update permission check
    if (body.status && body.status !== project.status) {
      if (!auth.canUpdateStatus) {
        return NextResponse.json({ error: 'У вашего ключа нет прав на изменение статуса' }, { status: 403 });
      }
      updateData.status = body.status;

      await db.insert(activityLogs).values({
        id: `act_${nanoid(10)}`,
        actorType: auth.isUser ? 'user' : 'agent',
        actorName: auth.isUser ? 'Admin' : auth.keyName || 'Agent',
        action: 'status_change',
        projectId: project.id,
        details: `Статус изменен с "${project.status}" на "${body.status}"`,
        createdAt: Date.now(),
      });

      dispatchNotification({
        event: 'project_status_changed',
        title: `Статус проекта изменен: "${project.title}"`,
        message: `Статус проекта изменен с "${project.status}" на "${body.status}".`,
        projectId: project.id,
        projectTitle: project.title,
        userId: auth.userId || undefined,
        data: {
          previousStatus: project.status,
          newStatus: body.status,
        },
        url: `/projects/${project.id}`,
      }).catch(() => {});
    }

    await db.update(projects).set(updateData).where(eq(projects.id, project.id));

    // Audit log for host migration (assignment / move / detach)
    if (updateData.hostId !== undefined && updateData.hostId !== project.hostId) {
      const [newHost] = updateData.hostId
        ? await db.select().from(hosts).where(eq(hosts.id, updateData.hostId)).limit(1)
        : [null];
      await db.insert(activityLogs).values({
        id: `act_${nanoid(10)}`,
        actorType: auth.isUser ? 'user' : 'agent',
        actorName: auth.isUser ? 'Admin' : auth.keyName || 'Agent',
        action: 'host_migration',
        projectId: project.id,
        details: updateData.hostId
          ? `Проект мигрирован на сервер "${newHost?.name || updateData.hostId}"`
          : 'Проект отвязан от сервера',
        createdAt: Date.now(),
      });
    }

    // Handle deployment update if provided
    if (body.deployment) {
      const [existingDep] = await db
        .select()
        .from(deployments)
        .where(eq(deployments.projectId, project.id))
        .limit(1);

      let rawContainers: any[] = [];
      if (body.deployment.containers) {
        if (typeof body.deployment.containers === 'string') {
          try {
            rawContainers = JSON.parse(body.deployment.containers);
          } catch {
            rawContainers = [];
          }
        } else if (Array.isArray(body.deployment.containers)) {
          rawContainers = body.deployment.containers;
        }
      }

      let primaryPort = body.deployment.internalPort ? Number(body.deployment.internalPort) : null;
      let primaryContainerName = body.deployment.containerName || null;

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
            name: body.deployment.serviceName || primaryContainerName || 'default',
            type: 'api',
            containerName: primaryContainerName,
            port: primaryPort,
            portType: 'http',
            isPublic: true,
          },
        ];
      }

      const depData = {
        runtimeType: body.deployment.runtimeType || 'docker_compose',
        deployAutomation: body.deployment.deployAutomation || 'manual_ssh',
        internalPort: primaryPort,
        containerName: primaryContainerName,
        serviceName: body.deployment.serviceName || null,
        containers: JSON.stringify(rawContainers),
        deployPath: body.deployment.deployPath || null,
        deployCommand: body.deployment.deployCommand || null,
        healthEndpoint: body.deployment.healthEndpoint || null,
        envKeysHint: body.deployment.envKeysHint || null,
        secretsType: body.deployment.secretsType || 'dotenv',
        secretsPathOrUri: body.deployment.secretsPathOrUri || null,
        notes: body.deployment.notes || null,
        backupEnabled: body.deployment.backupEnabled ? 1 : 0,
        backupSchedule: body.deployment.backupSchedule || null,
        backupTool: body.deployment.backupTool || null,
        backupDestination: body.deployment.backupDestination || null,
        storageProvider: body.deployment.storageProvider || null,
        storageBucket: body.deployment.storageBucket || null,
        storageEndpoint: body.deployment.storageEndpoint || null,
        ftpHost: body.deployment.ftpHost || null,
        ftpPort: body.deployment.ftpPort ? Number(body.deployment.ftpPort) : 22,
        ftpUser: body.deployment.ftpUser || null,
        ftpPath: body.deployment.ftpPath || null,
        sentryProject: body.deployment.sentryProject || null,
        updatedAt: Date.now(),
      };

      if (existingDep) {
        await db.update(deployments).set(depData).where(eq(deployments.id, existingDep.id));
      } else {
        await db.insert(deployments).values({
          id: `dep_${nanoid(10)}`,
          projectId: project.id,
          ...depData,
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Проект успешно обновлен' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка обновления' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(or(eq(projects.id, id), eq(projects.slug, id)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
  }

  const canDelete = await canUserManageMembers(auth, project.id);
  if (!canDelete) {
    return NextResponse.json({ error: 'Только владелец проекта или администратор может удалить его' }, { status: 403 });
  }

  await db.delete(projects).where(eq(projects.id, project.id));
  return NextResponse.json({ success: true, message: 'Проект удален' });
}
