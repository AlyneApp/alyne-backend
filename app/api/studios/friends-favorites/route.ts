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

    // Step 1: Get the current user's approved friends
    // We need to check both directions since friendships can be initiated by either user
    const { data: friends, error: friendsError } = await supabase
      .from('friends')
      .select('user_id, friend_id')
      .eq('approved', true)
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (friendsError) {
      console.error('Error fetching friends:', friendsError);
      return NextResponse.json(
        { error: 'Failed to fetch friends' },
        { status: 500 }
      );
    }

    // Extract friend IDs (excluding current user)
    const friendIds = new Set<string>();
    friends?.forEach(friendship => {
      if (friendship.user_id === user.id) {
        friendIds.add(friendship.friend_id);
      } else {
        friendIds.add(friendship.user_id);
      }
    });

    // Found friends for user

    // If user has no friends, return empty array
    if (friendIds.size === 0) {
      // User has no friends, returning empty list
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Step 2: Get studios liked by the user's friends
    const { data: studioLikes, error: likesError } = await supabase
      .from('studio_saves')
      .select(`
        studio_id,
        user_id,
        created_at,
        studios (
          id,
          name,
          description,
          image_urls,
          address,
          location
        ),
        users (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .in('user_id', Array.from(friendIds))
      .not('studios', 'is', null)
      .limit(50);

    if (likesError) {
      console.error('Error fetching studio likes:', likesError);
      return NextResponse.json(
        { error: 'Failed to fetch studio likes' },
        { status: 500 }
      );
    }

    if (!studioLikes || studioLikes.length === 0) {
      // No studios liked by friends
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Found studio likes from friends

    // Step 3: Group by studio and collect friend information for each like
    const studioLikeCounts = new Map();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    studioLikes.forEach((like: any) => {
      if (!like.studios || !like.users) {
        console.log('Warning: Missing studio or user data in like');
        return;
      }
      
      const studio = like.studios;
      const user = like.users;
      const studioId = studio.id;
      
      if (!studioLikeCounts.has(studioId)) {
        studioLikeCounts.set(studioId, {
          id: studio.id,
          name: studio.name,
          description: studio.description,
          image_url: studio.image_urls?.[0] || null, // Take first image from array
          address: studio.address,
          location: studio.location,
          like_count: 0,
          liked_by: [],
          created_at: like.created_at
        });
      }
      
      const studioData = studioLikeCounts.get(studioId);
      studioData.like_count += 1;
      studioData.liked_by.push({
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url
      });
    });

    // Step 4: Convert map to array and sort by friend like count (descending)
    const sortedStudios = Array.from(studioLikeCounts.values())
      .sort((a, b) => b.like_count - a.like_count)
      .slice(0, 10) // Limit to top 10
      .map(studio => ({
        ...studio,
        distance: Math.floor(Math.random() * 20) + 1, // Random distance 1-20 mins for now
        distance_unit: 'min away'
      }));

    // Log the first studio with its liked_by data
    if (sortedStudios.length > 0) {
      console.log(`First studio "${sortedStudios[0].name}" liked_by:`, sortedStudios[0].liked_by);
    }

    return NextResponse.json({
      success: true,
      data: sortedStudios,
    });

  } catch (error) {
    console.error('Friends favorites API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 