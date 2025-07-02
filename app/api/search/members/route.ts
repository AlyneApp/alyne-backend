import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get the user ID from the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    console.log('🔍 Search: Current user ID:', user.id);

    // Get search query from URL parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    console.log('🔍 Search: Query received:', query);

    if (!query || query.trim().length < 2) {
      console.log('🔍 Search: Query too short or empty');
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // First, let's see how many total users exist
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, username, full_name')
      .limit(5);

    console.log('🔍 Search: Total users in DB (sample):', allUsers?.length || 0);
    console.log('🔍 Search: Sample users:', allUsers?.map(u => ({username: u.username, full_name: u.full_name})));

    // Search for users by username and full_name (case-insensitive)
    const { data: users, error: searchError } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url')
      .neq('id', user.id) // Exclude current user
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(10)
      .order('username');

    console.log('🔍 Search: Search query executed');
    console.log('🔍 Search: Found users:', users?.length || 0);
    console.log('🔍 Search: Search error:', searchError);

    if (searchError) {
      console.error('Error searching users:', searchError);
      return NextResponse.json(
        { error: 'Failed to search users' },
        { status: 500 }
      );
    }

    console.log('🔍 Search: Returning results:', users);

    return NextResponse.json({
      success: true,
      data: users || [],
    });

  } catch (error) {
    console.error('Member search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 