import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createAuthError } from '../utils/response';

// List of public routes that don't require authentication
export const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/reset-password',
  '/api/auth/reset-password-confirm',
];

export async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest, supabase: ReturnType<typeof createRouteHandlerClient>) => Promise<NextResponse>
) {
  // Check if the route is public
  if (PUBLIC_ROUTES.includes(request.nextUrl.pathname)) {
    const supabase = createRouteHandlerClient({ cookies });
    return handler(request, supabase);
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get the session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return createAuthError('Unauthorized');
    }

    // Add the session to the request for use in the handler
    return handler(request, supabase);
  } catch (error) {
    console.error('Auth middleware error:', error);
    return createAuthError('Authentication failed');
  }
}

// Helper to get the current user
export async function getCurrentUser() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return null;
  }

  return session.user;
} 