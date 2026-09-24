import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { projects, hosts } from '@/db/schema';
import { authenticateRequest, isProjectAllowed } from '@/lib/rbac';
import { findOpenCodeFiles, searchOpenCodeContent, OpenCodeHostConfig } from '@/lib/opencode';
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
    return NextResponse.json({ error: 'Project has no host configured' }, { status: 400 });
  }

  const [host] = await db.select().from(hosts).where(eq(hosts.id, project.hostId)).limit(1);
  if (!host || !host.opencodeEnabled) {
    return NextResponse.json({ error: 'OpenCode is disabled on host' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || searchParams.get('pattern') || searchParams.get('query') || '';
  const type = searchParams.get('type') || 'file';

  if (!query) {
    return NextResponse.json({ success: true, results: [] });
  }

  try {
    if (type === 'file') {
      const results = await findOpenCodeFiles(host as OpenCodeHostConfig, query);
      return NextResponse.json({ success: true, type: 'file', query, results });
    } else {
      const results = await searchOpenCodeContent(host as OpenCodeHostConfig, query);
      return NextResponse.json({ success: true, type: 'content', query, results });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, results: [] }, { status: 500 });
  }
}
