import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, hosts } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { getOpenCodeVcs, OpenCodeHostConfig } from '@/lib/opencode';
import { eq } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: projectId } = await params;
  if (!auth.isAdmin && !isProjectAllowed(auth, projectId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || !project.hostId) {
    return NextResponse.json({ vcs: null });
  }

  const [host] = await db.select().from(hosts).where(eq(hosts.id, project.hostId)).limit(1);
  if (!host || !host.opencodeEnabled) {
    return NextResponse.json({ vcs: null });
  }

  try {
    const vcs = await getOpenCodeVcs(host as OpenCodeHostConfig);
    return NextResponse.json({ success: true, vcs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, vcs: null }, { status: 500 });
  }
}
