import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseEdge } from '@/lib/supabase-edge';

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/studios/featured',
  '/api/search/events',
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Allow non-API routes
  if (!path.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_ROUTES.includes(path)) {
    return NextResponse.next();
  }

  // For all other API routes, require authentication
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: { user }, error } = await supabaseEdge.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*']
}; 