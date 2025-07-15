/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper function to enhance users with friendship data
async function enhanceUsersWithFriendshipData(users: Array<{
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  followers_count: number;
}>, currentUserId: string) {
  if (!users || users.length === 0) return [];

  // Get all friend relationships in one query
  const userIds = users.map(u => u.id);
  const allUserIds = [...userIds, currentUserId];
  
  const { data: friendshipData, error: friendshipError } = await supabase
    .from('friends')
    .select('user_id, friend_id')
    .in('user_id', allUserIds)
    .in('friend_id', allUserIds)
    .eq('approved', true);

  if (friendshipError) {
    console.error('⚠️ Error getting friendship data:', friendshipError);
    throw new Error('Failed to get friendship data');
  }

  console.log('🤝 All friendship data:', friendshipData);

  // Process each user
  const enhancedUsers = users.map(searchUser => {
    // Calculate friend count for this user
    const friendCount = friendshipData.filter(f => 
      (f.user_id === searchUser.id || f.friend_id === searchUser.id)
    ).length;

    // Check if current user follows this search user
    const i_follow = friendshipData.some(f => 
      f.user_id === currentUserId && f.friend_id === searchUser.id
    );

    // Check if search user follows current user
    const follows_me = friendshipData.some(f => 
      f.user_id === searchUser.id && f.friend_id === currentUserId
    );

    // Calculate mutual friends
    const currentUserFriends = new Set();
    const searchUserFriends = new Set();

    // Get current user's friends
    friendshipData.forEach(f => {
      if (f.user_id === currentUserId) currentUserFriends.add(f.friend_id);
      if (f.friend_id === currentUserId) currentUserFriends.add(f.user_id);
    });

    // Get search user's friends
    friendshipData.forEach(f => {
      if (f.user_id === searchUser.id) searchUserFriends.add(f.friend_id);
      if (f.friend_id === searchUser.id) searchUserFriends.add(f.user_id);
    });

    // Count mutual friends
    const mutualFriends = [...currentUserFriends].filter(friendId => 
      searchUserFriends.has(friendId)
    ).length;

    const enhancedUser = {
      id: searchUser.id,
      username: searchUser.username,
      full_name: searchUser.full_name,
      avatar_url: searchUser.avatar_url,
      follower_count: friendCount,
      mutual_friends: mutualFriends,
      i_follow,
      follows_me,
    };

    console.log('✨ Enhanced user:', {
      username: enhancedUser.username,
      follower_count: enhancedUser.follower_count,
      mutual_friends: enhancedUser.mutual_friends,
      i_follow: enhancedUser.i_follow,
      follows_me: enhancedUser.follows_me,
    });

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

    console.log('🔍 Searching for members with query:', query, 'for user:', user.id);

    // Search for users with their friend counts calculated directly
    const { data: users } = await supabase
      .from('users')
      .select(`
        id, 
        username, 
        full_name, 
        avatar_url,
        followers_count
      `)
      .neq('id', user.id) // Exclude current user
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(4)
      .order('username');

    if (!users || users.length === 0) {
      console.log('📭 No users found for query:', query);
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    console.log('👥 Found users:', users.map(u => ({ username: u.username, id: u.id })));

    // Enhance users with friendship data
    const enhancedUsers = await enhanceUsersWithFriendshipData(users, user.id);

    console.log('📋 Final response data count:', enhancedUsers.length);

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
    const { data: users } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, followers_count')
      .neq('id', user.id)
      .not('id', 'in', `(${followedIds.length > 0 ? followedIds.join(',') : 'NULL'})`)
      .limit(4)
      .order('followers_count', { ascending: false });

    return NextResponse.json({
      success: true,
      data: users || [],
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 