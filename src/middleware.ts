import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'visor-super-secret-key-change-in-production-2026'
);

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/demo',
  '/api/version',
  '/_next',
  '/favicon.ico',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and public auth routes
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check session cookie
  const sessionToken = request.cookies.get('pv_session')?.value;

  if (!sessionToken) {
    // If it's an API route called without cookie, check if there's an Authorization Bearer header
    if (pathname.startsWith('/api/')) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return NextResponse.next();
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Redirect guest users to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Verify JWT
    await jwtVerify(sessionToken, JWT_SECRET);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
