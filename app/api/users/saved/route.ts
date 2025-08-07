import { NextRequest, NextResponse } from 'next/server';
import { supabase, createAuthenticatedClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    
    // Create an authenticated client with the user's JWT token
    const authenticatedSupabase = createAuthenticatedClient(token);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get userId from query params, default to current user
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId') || user.id;

    // Get all studios the target user has saved
    const { data: saves, error: savesError } = await authenticatedSupabase
      .from('studio_saves')
      .select(`
        studio_id,
        created_at,
        studios (
          id,
          name,
          address,
          image_urls
        )
      `)
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (savesError) {
      console.error('Error fetching user saves:', savesError);
      return NextResponse.json(
        { error: 'Failed to fetch user saves' },
        { status: 500 }
      );
    }

    console.log('Found saves:', saves);

    if (!saves || saves.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const savedStudios = saves.map(save => ({
      id: save.studio_id,
      studio: save.studios,
      saved_at: save.created_at,
    })).filter(item => item.studio) || [];

    return NextResponse.json({
      success: true,
      data: savedStudios,
    });

  } catch (error) {
    console.error('Users/saved API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 