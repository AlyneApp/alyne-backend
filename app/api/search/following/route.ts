import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';





const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const token = authHeader.substring(7);
    
    // Verify the current user
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !currentUser) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get following (users that the target user follows)
    const { data: following, error: followingError } = await supabase
      .from('friends')
      .select(`
        friend_id,
        users!friends_friend_id_fkey (
          id,
          username,
          full_name,
          avatar_url,
          followers_count,
          following_count
        )
      `)
      .eq('user_id', userId)
      .eq('approved', true);

    if (followingError) {
      console.error('Error fetching following:', followingError);
      return NextResponse.json({ error: 'Failed to fetch following' }, { status: 500 });
    }

    // Get current user's following status for each followed user
    const { data: currentUserFollowing, error: currentUserFollowingError } = await supabase
      .from('friends')
      .select('friend_id')
      .eq('user_id', currentUser.id)
      .eq('approved', true);

    if (currentUserFollowingError) {
      console.error('Error fetching current user following:', currentUserFollowingError);
      return NextResponse.json({ error: 'Failed to fetch following status' }, { status: 500 });
    }

    const currentUserFollowingIds = new Set(currentUserFollowing?.map(f => f.friend_id) || []);

    // Transform the data
    const transformedFollowing = following
      ?.map((follow: any) => {
        const user = follow.users; // users is an object, not an array
        if (!user) return null;
        
        return {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
          followers_count: user.followers_count || 0,
          following_count: user.following_count || 0,
          is_following: currentUserFollowingIds.has(user.id),
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      data: transformedFollowing || []
    });

  } catch (error) {
    console.error('Error in following API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 