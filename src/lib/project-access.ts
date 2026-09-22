import { db } from '@/db';
import { projects, projectMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { AuthContext } from './rbac';

export type ProjectAccessRole = 'owner' | 'admin' | 'editor' | 'viewer';

/**
 * Returns all project IDs accessible to the current user or agent
 */
export async function getAccessibleProjectIds(auth: AuthContext): Promise<string[]> {
  const allProjects = await db.select({ id: projects.id, ownerId: projects.ownerId }).from(projects);

  if (auth.isAdmin) {
    return allProjects.map((p) => p.id);
  }

  if (auth.isUser && auth.userId) {
    // 1. Projects where user is owner
    const ownedIds = allProjects.filter((p) => p.ownerId === auth.userId).map((p) => p.id);

    // 2. Projects where user is a member
    const memberships = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, auth.userId));

    const memberIds = memberships.map((m) => m.projectId);

    // Union of unique IDs
    return Array.from(new Set([...ownedIds, ...memberIds]));
  }

  // AI Agent or API Key
  if (!auth.isUser) {
    let baseAllowedIds: string[] = [];

    if (auth.userId) {
      // Token belongs to a specific user -> restrict to projects that user has access to!
      const userOwned = allProjects.filter((p) => p.ownerId === auth.userId).map((p) => p.id);
      const userMemberships = await db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(eq(projectMembers.userId, auth.userId));
      const userMemberIds = userMemberships.map((m) => m.projectId);
      baseAllowedIds = Array.from(new Set([...userOwned, ...userMemberIds]));
    } else {
      baseAllowedIds = allProjects.map((p) => p.id);
    }

    if (auth.roleScope === 'scoped_projects') {
      return auth.allowedProjectIds.filter((id) => baseAllowedIds.includes(id));
    }

    return baseAllowedIds;
  }

  return [];
}

/**
 * Get detailed role of a user on a specific project
 */
export async function getUserProjectRole(
  userId: string,
  projectId: string,
  isGlobalAdmin: boolean = false
): Promise<ProjectAccessRole | null> {
  if (isGlobalAdmin) return 'admin';

  const [project] = await db
    .select({ ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) return null;

  if (project.ownerId === userId) {
    return 'owner';
  }

  const [membership] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);

  if (membership) {
    return membership.role as ProjectAccessRole;
  }

  return null;
}

/**
 * Check if caller can edit project details, tasks, deployments
 */
export async function canUserEditProject(auth: AuthContext, projectId: string): Promise<boolean> {
  if (auth.isAdmin) return true;

  if (auth.isUser && auth.userId) {
    if (auth.role === 'viewer') return false;
    const role = await getUserProjectRole(auth.userId, projectId, auth.isAdmin);
    return role === 'owner' || role === 'admin' || role === 'editor';
  }

  // For API agent tokens
  if (!auth.isUser) {
    if (!auth.canUpdateStatus && !auth.canWriteKanban && !auth.canManageProjects) return false;
    const allowed = await getAccessibleProjectIds(auth);
    return allowed.includes(projectId);
  }

  return false;
}

/**
 * Check if caller can manage (grant / revoke) member access to a project
 */
export async function canUserManageMembers(auth: AuthContext, projectId: string): Promise<boolean> {
  if (auth.isAdmin) return true;

  if (auth.isUser && auth.userId) {
    if (auth.role === 'viewer') return false;
    const role = await getUserProjectRole(auth.userId, projectId, auth.isAdmin);
    return role === 'owner' || role === 'admin';
  }

  return false;
}
