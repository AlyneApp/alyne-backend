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

// CORS headers helper
function getCorsHeaders(origin: string | null) {
  // Allow requests from any origin (mobile apps, web, etc.)
  // Mobile apps may not send an origin header, so we default to allowing all
  // In production, you might want to restrict this to specific domains
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8081',
    'http://localhost:19006',
    'exp://localhost:8081',
    'https://alyne-backend.vercel.app',
  ];

  // For mobile apps that don't send origin, or for allowed origins, set the origin
  // If no origin is provided (mobile app), use '*' but don't set credentials
  // If origin is provided and allowed, use it and allow credentials
  const isAllowedOrigin = !origin || allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('exp://');
  
  // When origin is not provided (mobile apps), use '*' and don't set credentials
  // When origin is provided, use it and allow credentials
  if (!origin || !isAllowedOrigin) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    };
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const origin = request.headers.get('origin');

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: getCorsHeaders(origin),
    });
  }

  // Allow public routes
  if (PUBLIC_ROUTES.includes(path)) {
    const response = NextResponse.next();
    // Add CORS headers
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // For all other API routes, require authentication
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    const response = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    // Add CORS headers even to error responses
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  const { data: { user }, error } = await supabaseEdge.auth.getUser(token);
  if (error || !user) {
    const response = NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    // Add CORS headers even to error responses
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  const response = NextResponse.next();
  // Add CORS headers to authenticated responses
  Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export const config = {
  matcher: ['/api/:path*']
}; 