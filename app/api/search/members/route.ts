/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper function to enhance users with follow data
async function enhanceUsersWithFollowData(users: Array<{
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  followers_count: number;
  is_instructor: boolean;
}>, currentUserId: string) {
  if (!users || users.length === 0) return [];

  // Get all follow relationships in one query (both approved and pending)
  const userIds = users.map(u => u.id);

  const { data: followData, error: followError } = await supabase
    .from('friends')
    .select('user_id, friend_id, approved')
    .in('user_id', [currentUserId, ...userIds])
    .in('friend_id', [currentUserId, ...userIds]);

  if (followError) {
    console.error('⚠️ Error getting follow data:', followError);
    throw new Error('Failed to get follow data');
  }

  // Process each user
  const enhancedUsers = users.map(searchUser => {
    // Calculate follower count for this user (only approved followers)
    const followerCount = followData.filter(f =>
      f.friend_id === searchUser.id && f.approved
    ).length;

    // Check if current user follows this search user (approved or pending)
    const followRelationship = followData.find(f =>
      f.user_id === currentUserId && f.friend_id === searchUser.id
    );

    const i_follow = !!followRelationship;
    const is_pending = followRelationship && !followRelationship.approved;

    const enhancedUser = {
      id: searchUser.id,
      username: searchUser.username,
      full_name: searchUser.full_name,
      avatar_url: searchUser.avatar_url,
      followers_count: followerCount,
      is_following: i_follow && followRelationship?.approved,
      follow_request_status: followRelationship ? (followRelationship.approved ? 'approved' : 'pending') : null,
      is_instructor: searchUser.is_instructor || false,
    };

    return enhancedUser;
  });

  return enhancedUsers;
}

// GET - Search members (existing functionality)
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

    // Get search query from URL parameters
    const query = new URL(request.url).searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Searching for members with query

    // Search for users with their friend counts calculated directly
    const { data: users } = await supabase
      .from('users')
      .select(`
        id, 
        username, 
        full_name, 
        avatar_url,
        followers_count,
        is_instructor
      `)
      .neq('id', user.id) // Exclude current user
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(4)
      .order('username');

    if (!users || users.length === 0) {
      // No users found for query
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Found users for search query

    // Enhance users with follow data
    const enhancedUsers = await enhanceUsersWithFollowData(users, user.id);

    // Final response data count

    return NextResponse.json({
      success: true,
      data: enhancedUsers,
    });

  } catch (error) {
    console.error('Member search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Get recommended members
export async function POST(request: NextRequest) {
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

    // First get users the current user already follows
    const { data: followedUsers } = await supabase
      .from('friends')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('approved', true);

    const followedIds = followedUsers?.map(f => f.friend_id) || [];

    // Get top 4 users the current user doesn't follow
    let usersQuery = supabase
      .from('users')
      .select('id, username, full_name, avatar_url, followers_count, is_instructor, activity_feed!activity_feed_user_id_fkey(count)')
      .neq('id', user.id);

    if (followedIds.length > 0) {
      // Use proper Postgres tuple syntax for UUIDs in validation
      usersQuery = usersQuery.not('id', 'in', `(${followedIds.map(id => `"${id}"`).join(',')})`);
    }


    // Fetch more candidates to filter by post count
    const { data: candidates, error: usersError } = await usersQuery
      .limit(100)
      .order('followers_count', { ascending: false });

    // Filter for users with at least 3 posts and sort by post count
    // @ts-ignore - Supabase types for joined count can be tricky
    const users = candidates
      ?.filter(u => {
        const postCount = u.activity_feed?.[0]?.count || 0;
        return postCount >= 3;
      })
      .sort((a, b) => {
        // @ts-ignore
        const countA = a.activity_feed?.[0]?.count || 0;
        // @ts-ignore
        const countB = b.activity_feed?.[0]?.count || 0;
        return countB - countA;
      })
      .slice(0, 4) || [];

    if (usersError) {
      console.error('❌ Error fetching recommended users:', usersError);
    }

    console.log(`🔍 Found ${users?.length || 0} recommended users for user ${user.id}. Followed count: ${followedIds.length}`);

    if (!users || users.length === 0) {
      console.log('🔍 No recommended users found with filters. Trying a simpler catch-all query...');
      const { data: allUsers, error: allUsersError } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url, followers_count, is_instructor')
        .neq('id', user.id)
        .limit(10);

      if (allUsersError) {
        console.error('❌ Error in catch-all users query:', allUsersError);
      }

      if (allUsers && allUsers.length > 0) {
        console.log(`🔍 Catch-all found ${allUsers.length} users. Returning these instead.`);
        const enhancedUsers = await enhanceUsersWithFollowData(allUsers, user.id);
        return NextResponse.json({
          success: true,
          data: enhancedUsers,
        });
      }

      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Enhance users with follow data
    const enhancedUsers = await enhanceUsersWithFollowData(users, user.id);

    return NextResponse.json({
      success: true,
      data: enhancedUsers,
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 