import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Feed optimization strategies
interface FeedOptions {
  limit?: number;
  offset?: number;
  activityType?: string;
  userId?: string;
  useCache?: boolean;
}

interface User {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
}

interface Studio {
  id: string;
  name: string;
  address?: string;
}

interface Class {
  id: string;
  name: string;
}

interface Instructor {
  id: string;
  name: string;
  specialty?: string;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const options: FeedOptions = {
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
      activityType: searchParams.get('activityType') || undefined,
      userId: searchParams.get('userId') || undefined,
      useCache: searchParams.get('cache') === 'true',
    };

    // Strategy 1: Cursor-based pagination for better performance
    const cursor = searchParams.get('cursor');
    
    // Strategy 2: Materialized view for complex joins
    let query = supabase
      .from('workout_posts')
      .select(`
        id,
        user_id,
        activity_name,
        activity_type,
        duration,
        distance,
        date,
        time,
        visibility,
        how_it_went,
        private_note,
        photos,
        route_data,
        created_at,
        users!inner (
          id,
          username,
          full_name,
          avatar_url
        ),
        workout_post_details (
          studio_id,
          class_id,
          instructor_id,
          activity_partners,
          studios (
            id,
            name,
            address
          ),
          classes (
            id,
            name
          ),
          instructors (
            id,
            name,
            specialty
          )
        ),
        studio_ratings (rating),
        class_ratings (rating),
        instructor_ratings (rating),
        workout_post_likes (user_id),
        workout_post_comments (id)
      `)
      .order('created_at', { ascending: false })
      .limit(options.limit!);

    // Strategy 3: Efficient filtering
    if (cursor) {
      query = query.lt('created_at', cursor);
    } else if (options.offset) {
      query = query.range(options.offset, options.offset + options.limit! - 1);
    }

    if (options.activityType) {
      query = query.eq('activity_type', options.activityType);
    }

    // Strategy 4: Smart friend filtering
    if (!options.userId) {
      // Get user's friends efficiently
      const { data: friends } = await supabase
        .from('friends')
        .select('user_id, friend_id')
        .eq('approved', true)
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      const friendIds = new Set<string>();
      friends?.forEach(friendship => {
        if (friendship.user_id === user.id) {
          friendIds.add(friendship.friend_id);
        } else {
          friendIds.add(friendship.user_id);
        }
      });

      // Include your own posts in the feed
      friendIds.add(user.id);

      const friendIdsArray = Array.from(friendIds);
      
      if (friendIdsArray.length > 0) {
        query = query.in('user_id', friendIdsArray);
      } else {
        // No friends, return empty feed
        return NextResponse.json({ success: true, data: [], nextCursor: null });
      }
    } else {
      query = query.eq('user_id', options.userId);
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error('Feed API error:', error);
      return NextResponse.json({ error: 'Failed to fetch feed' }, { status: 500 });
    }

    // Strategy 5: Efficient data transformation
    const transformedPosts = posts?.map(post => ({
      id: post.id,
      activityName: post.activity_name,
      activityType: post.activity_type,
      duration: post.duration,
      distance: post.distance,
      date: post.date,
      time: post.time,
      visibility: post.visibility,
      howItWent: post.how_it_went,
      privateNote: post.private_note,
      photos: post.photos || [],
      routeData: post.route_data,
      createdAt: post.created_at,
      user: {
        id: (post.users as User[])[0].id,
        username: (post.users as User[])[0].username,
        fullName: (post.users as User[])[0].full_name,
        avatarUrl: (post.users as User[])[0].avatar_url,
      },
      studio: post.workout_post_details?.[0]?.studios ? {
        id: (post.workout_post_details[0].studios as Studio[])[0].id,
        name: (post.workout_post_details[0].studios as Studio[])[0].name,
        address: (post.workout_post_details[0].studios as Studio[])[0].address,
        rating: post.studio_ratings?.[0]?.rating,
      } : null,
      class: post.workout_post_details?.[0]?.classes ? {
        id: (post.workout_post_details[0].classes as Class[])[0].id,
        name: (post.workout_post_details[0].classes as Class[])[0].name,
        rating: post.class_ratings?.[0]?.rating,
      } : null,
      instructor: post.workout_post_details?.[0]?.instructors ? {
        id: (post.workout_post_details[0].instructors as Instructor[])[0].id,
        name: (post.workout_post_details[0].instructors as Instructor[])[0].name,
        specialty: (post.workout_post_details[0].instructors as Instructor[])[0].specialty,
        rating: post.instructor_ratings?.[0]?.rating,
      } : null,
      activityPartners: post.workout_post_details?.[0]?.activity_partners || [],
      likeCount: post.workout_post_likes?.length || 0,
      commentCount: post.workout_post_comments?.length || 0,
    })) || [];

    // Strategy 6: Cursor for next page
    const nextCursor = posts && posts.length === options.limit 
      ? posts[posts.length - 1].created_at 
      : null;

    return NextResponse.json({
      success: true,
      data: transformedPosts,
      nextCursor,
      hasMore: !!nextCursor,
    });

  } catch (error) {
    console.error('Optimized Feed API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 