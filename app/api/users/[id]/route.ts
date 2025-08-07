import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const { id } = await params;

    // Get the target user's profile data - try selecting all fields first
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        full_name,
        avatar_url,
        created_at,
        is_private,
        wellness_visible
      `)
      .eq('id', id)
      .single();

    console.log('Raw database response:', targetUser);
    console.log('Database error:', userError);
    console.log('Wellness visible from DB:', targetUser?.wellness_visible, typeof targetUser?.wellness_visible);

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate correct follower count (only approved followers)
    const { count: followersCount, error: followersError } = await supabase
      .from('friends')
      .select('*', { count: 'exact', head: true })
      .eq('friend_id', id)
      .eq('approved', true);

    if (followersError) {
      console.error('Error fetching followers count:', followersError);
    }

    // Calculate correct following count (only approved following)
    const { count: followingCount, error: followingError } = await supabase
      .from('friends')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', id)
      .eq('approved', true);

    if (followingError) {
      console.error('Error fetching following count:', followingError);
    }

    // Check if current user follows the target user
    const { data: followData } = await supabase
      .from('friends')
      .select('approved')
      .eq('user_id', user.id)
      .eq('friend_id', id)
      .single();

    const isFollowing = !!followData?.approved;
    
    // Check if current user can view the profile content
    const isOwnProfile = user.id === id;
    const canViewContent = isOwnProfile || !targetUser.is_private || isFollowing;

    console.log('User profile data:', {
      ...targetUser,
      followers_count: followersCount || 0,
      following_count: followingCount || 0,
      is_following: isFollowing,
      can_view_content: canViewContent,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...targetUser,
        followers_count: followersCount || 0,
        following_count: followingCount || 0,
        is_following: isFollowing,
        can_view_content: canViewContent,
      },
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 