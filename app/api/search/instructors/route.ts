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
      i_follow,
      is_pending,
    };

    return enhancedUser;
  });

  return enhancedUsers;
}

// GET - Search instructors (filtered by is_instructor = true)
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

    // Searching for instructors with query

    // Search for users with is_instructor = true and their friend counts calculated directly
    const { data: users } = await supabase
      .from('users')
      .select(`
        id, 
        username, 
        full_name, 
        avatar_url,
        followers_count
      `)
      .eq('is_instructor', true) // Only get users who are instructors
      .neq('id', user.id) // Exclude current user
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(4)
      .order('username');

    if (!users || users.length === 0) {
      // No instructors found for query
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Found instructors for search query

    // Enhance users with follow data
    const enhancedUsers = await enhanceUsersWithFollowData(users, user.id);

    // Final response data count

    return NextResponse.json({
      success: true,
      data: enhancedUsers,
    });

  } catch (error) {
    console.error('Instructor search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Get recommended instructors (filtered by is_instructor = true)
export async function POST(request: NextRequest) {
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

    // Get limit from URL parameters
    const limit = new URL(request.url).searchParams.get('limit');
    const limitNumber = limit ? parseInt(limit) : 10;

    // First, get all instructors with their follower counts
    const { data: allInstructors } = await supabase
      .from('users')
      .select(`
        id, 
        username, 
        full_name, 
        avatar_url,
        followers_count
      `)
      .eq('is_instructor', true) // Only get users who are instructors
      .neq('id', user.id) // Exclude current user
      .order('followers_count', { ascending: false }); // Order by follower count (most popular first)

    if (!allInstructors || allInstructors.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Enhance all instructors with follow data
    const enhancedInstructors = await enhanceUsersWithFollowData(allInstructors, user.id);

    // Filter out instructors that the user already follows
    const notFollowingInstructors = enhancedInstructors.filter(instructor => !instructor.i_follow);

    // Take the top instructors by follower count (who the user doesn't follow)
    const recommendedInstructors = notFollowingInstructors.slice(0, limitNumber);

    return NextResponse.json({
      success: true,
      data: recommendedInstructors,
    });

  } catch (error) {
    console.error('Recommended instructors API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
