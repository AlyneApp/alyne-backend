import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'Set' : 'Missing',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? 'Set' : 'Missing',
    // Check for old variable names as fallback
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ? 'Set (old name)' : 'Missing',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'Set (old name)' : 'Missing',
  });
  throw new Error('Missing required Supabase environment variables');
}

// Log initialization (only once, not on every import)
if (!(global as any).__SUPABASE_EDGE_INIT_LOGGED) {
  console.log('Supabase Edge Client initialized:', {
    url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'Missing',
    key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'Missing',
  });
  (global as any).__SUPABASE_EDGE_INIT_LOGGED = true;
}

export const supabaseEdge = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
