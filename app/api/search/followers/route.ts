import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';





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

    // Get followers (users who follow the target user)
    const { data: followers, error: followersError } = await supabase
      .from('friends')
      .select(`
        user_id,
        users!friends_user_id_fkey (
          id,
          username,
          full_name,
          avatar_url,
          followers_count,
          following_count
        )
      `)
      .eq('friend_id', userId)
      .eq('approved', true);

    if (followersError) {
      console.error('Error fetching followers:', followersError);
      return NextResponse.json({ error: 'Failed to fetch followers' }, { status: 500 });
    }

    // Get current user's following status for each follower
    const { data: currentUserFollowing, error: followingError } = await supabase
      .from('friends')
      .select('friend_id')
      .eq('user_id', currentUser.id)
      .eq('approved', true);

    if (followingError) {
      console.error('Error fetching current user following:', followingError);
      return NextResponse.json({ error: 'Failed to fetch following status' }, { status: 500 });
    }

    const currentUserFollowingIds = new Set(currentUserFollowing?.map(f => f.friend_id) || []);

    // Transform the data
    const transformedFollowers = followers
      ?.map((follower: any) => {
        const user = follower.users; // users is an object, not an array
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
      data: transformedFollowers || []
    });

  } catch (error) {
    console.error('Error in followers API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 