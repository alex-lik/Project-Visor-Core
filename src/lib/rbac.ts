import crypto from 'crypto';
import { db } from '@/db';
import { apiKeys, projects, projectMembers, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUser } from './auth';

export interface AuthContext {
  isUser: boolean;
  userId?: string;
  username?: string;
  role?: string;
  isAdmin: boolean;
  apiKeyId?: string;
  keyName?: string;
  roleScope: 'all_projects' | 'scoped_projects';
  allowedProjectIds: string[];
  canWriteKanban: boolean;
  canUpdateStatus: boolean;
  canViewInfra: boolean;
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const rawKey = `pv_live_${randomBytes}`;
  const keyPrefix = rawKey.slice(0, 12);
  const keyHash = hashApiKey(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

export async function authenticateRequest(request: Request): Promise<AuthContext | null> {
  // 1. Check Bearer token (API Key for Agents or curl)
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!token) return null;

    const tokenHash = hashApiKey(token);
    const [keyRecord] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, tokenHash))
      .limit(1);

    if (!keyRecord) return null;

    // Check expiration
    if (keyRecord.expiresAt && keyRecord.expiresAt < Date.now()) {
      return null;
    }

    // Update last used asynchronously
    db.update(apiKeys)
      .set({ lastUsedAt: Date.now() })
      .where(eq(apiKeys.id, keyRecord.id))
      .catch(() => {});

    // Calculate user's accessible projects if token is tied to a user
    let userAccessibleIds: string[] = [];
    if (keyRecord.userId) {
      const [tokenOwner] = await db
        .select()
        .from(users)
        .where(eq(users.id, keyRecord.userId))
        .limit(1);

      if (tokenOwner) {
        if (tokenOwner.role === 'admin') {
          const allP = await db.select({ id: projects.id }).from(projects);
          userAccessibleIds = allP.map((p) => p.id);
        } else {
          const owned = await db
            .select({ id: projects.id })
            .from(projects)
            .where(eq(projects.ownerId, keyRecord.userId));
          const member = await db
            .select({ projectId: projectMembers.projectId })
            .from(projectMembers)
            .where(eq(projectMembers.userId, keyRecord.userId));
          userAccessibleIds = Array.from(
            new Set([...owned.map((o) => o.id), ...member.map((m) => m.projectId)])
          );
        }
      }
    } else {
      const allP = await db.select({ id: projects.id }).from(projects);
      userAccessibleIds = allP.map((p) => p.id);
    }

    let allowedIds: string[] = [];
    try {
      allowedIds = JSON.parse(keyRecord.allowedProjectIds || '[]');
    } catch {
      allowedIds = [];
    }

    if (keyRecord.roleScope === 'scoped_projects') {
      allowedIds = allowedIds.filter((id) => userAccessibleIds.includes(id));
    } else {
      allowedIds = userAccessibleIds;
    }

    return {
      isUser: false,
      userId: keyRecord.userId || undefined,
      isAdmin: false,
      apiKeyId: keyRecord.id,
      keyName: keyRecord.name,
      roleScope: keyRecord.roleScope as 'all_projects' | 'scoped_projects',
      allowedProjectIds: allowedIds,
      canWriteKanban: Boolean(keyRecord.canWriteKanban),
      canUpdateStatus: Boolean(keyRecord.canUpdateStatus),
      canViewInfra: Boolean(keyRecord.canViewInfra),
    };
  }

  // 2. Check UI User Session Cookie
  const user = await getSessionUser();
  if (user) {
    let allowedIds: string[] = [];
    const isAdmin = user.role === 'admin';

    if (!isAdmin) {
      const owned = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.ownerId, user.userId));
      const member = await db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(eq(projectMembers.userId, user.userId));
      allowedIds = Array.from(
        new Set([...owned.map((o) => o.id), ...member.map((m) => m.projectId)])
      );
    }

    return {
      isUser: true,
      userId: user.userId,
      username: user.username,
      role: user.role,
      isAdmin,
      roleScope: isAdmin ? 'all_projects' : 'scoped_projects',
      allowedProjectIds: allowedIds,
      canWriteKanban: true,
      canUpdateStatus: true,
      canViewInfra: true,
    };
  }

  return null;
}

export function isProjectAllowed(auth: AuthContext, projectId: string): boolean {
  if (auth.isAdmin) {
    return true;
  }
  if (!auth.isUser && !auth.userId && auth.roleScope === 'all_projects') {
    return true;
  }
  return auth.allowedProjectIds.includes(projectId);
}

