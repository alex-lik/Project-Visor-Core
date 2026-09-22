import { NextResponse } from 'next/server';
import { getVersionInfo } from '@/lib/version';

export async function GET() {
  const versionData = getVersionInfo();
  return NextResponse.json(
    {
      status: 'ok',
      ...versionData,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    }
  );
}
