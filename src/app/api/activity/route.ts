import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { activityLogs, projects } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const logs = await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(50);
  const allProjects = await db.select().from(projects);

  const filtered = logs
    .filter((l) => !l.projectId || isProjectAllowed(auth, l.projectId))
    .map((l) => {
      const p = l.projectId ? allProjects.find((proj) => proj.id === l.projectId) : null;
      return {
        ...l,
        projectTitle: p?.title || null,
        projectSlug: p?.slug || null,
      };
    });

  return NextResponse.json({ logs: filtered });
}
