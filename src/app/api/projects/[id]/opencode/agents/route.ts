import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, hosts } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { listOpenCodeAgents, OpenCodeHostConfig } from '@/lib/opencode';
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
    return NextResponse.json({ agents: [] });
  }

  const [host] = await db.select().from(hosts).where(eq(hosts.id, project.hostId)).limit(1);
  if (!host || !host.opencodeEnabled) {
    return NextResponse.json({ agents: [] });
  }

  try {
    const agents = await listOpenCodeAgents(host as OpenCodeHostConfig);
    // Filter out internal hidden agents like compaction/summary/title by default or flag them
    const userFacingAgents = agents.filter((a) => !a.hidden || a.mode === 'primary');
    return NextResponse.json({ success: true, agents: userFacingAgents.length > 0 ? userFacingAgents : agents });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, agents: [] }, { status: 500 });
  }
}
