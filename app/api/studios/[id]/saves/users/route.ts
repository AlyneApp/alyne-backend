import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: studioId } = await params;

    // First, get all users that the current user follows
    const { data: following, error: followingError } = await supabase
      .from('friends')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('approved', true);

    if (followingError) {
      console.error('Error fetching following:', followingError);
      return NextResponse.json(
        { error: 'Failed to fetch following' },
        { status: 500 }
      );
    }

    if (!following || following.length === 0) {
      // User doesn't follow anyone, so no friends want to try
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const followingIds = following.map(f => f.friend_id);

    // Get all users who saved this studio and are followed by the current user
    const { data: saves, error: savesError } = await supabase
      .from('studio_saves')
      .select(`
        user_id,
        created_at,
        users (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('studio_id', studioId)
      .in('user_id', followingIds);

    if (savesError) {
      console.error('Error fetching studio saves:', savesError);
      return NextResponse.json(
        { error: 'Failed to fetch studio saves' },
        { status: 500 }
      );
    }

    console.log(`Found ${saves?.length || 0} saves for studio ${studioId}`);
    console.log('Saves data:', saves);

    if (!saves || saves.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Transform the data to match the expected format
    const usersWhoSaved = saves
      .filter(save => save.users) // Filter out any null users
      .map(save => ({
        id: save.users.id,
        username: save.users.username,
        full_name: save.users.full_name,
        avatar_url: save.users.avatar_url,
      }));

    console.log(`Returning ${usersWhoSaved.length} users who saved this studio`);

    return NextResponse.json({
      success: true,
      data: usersWhoSaved,
    });

  } catch (error) {
    console.error('Error in studio saves users API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 