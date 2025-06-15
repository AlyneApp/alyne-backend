import { createServerClient } from '@supabase/ssr';
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

async function createSupabaseClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

export async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest, supabase: Awaited<ReturnType<typeof createSupabaseClient>>) => Promise<NextResponse>
) {
  // Check if the route is public
  if (PUBLIC_ROUTES.includes(request.nextUrl.pathname)) {
    const supabase = await createSupabaseClient();
    return handler(request, supabase);
  }

  try {
    const supabase = await createSupabaseClient();
    
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
  const supabase = await createSupabaseClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return null;
  }

  return session.user;
} 