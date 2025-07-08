import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface ClassActivityDetails {
  class_name: string;
  class_schedule?: string;
  instructor_name?: string;
}

interface StudioActivityDetails {
  like_count?: number;
}

interface PostActivityDetails {
  message?: string;
  title?: string;
}

type ActivityMetadata = ClassActivityDetails | StudioActivityDetails | PostActivityDetails | Record<string, unknown>;

interface ActivityFeedItem {
  id: string;
  user_id: string;
  type: string;
  studio_id: string | null;
  extra_data: ActivityMetadata; // This maps to the JSONB field in database
  created_at: string;
  users: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  studios?: {
    id: string;
    name: string;
    address: string | null;
  } | null;
}

interface FormattedActivity {
  messageParts: Array<{
    text: string;
    bold: boolean;
    clickable: boolean;
  }>;
  type: string | null;
  schedule: string | null;
  buttonLabel?: string;
}

function formatActivityMessage(activity: ActivityFeedItem): FormattedActivity {
  const username = activity.users?.full_name || activity.users?.username || 'Someone';
  const metadata = activity.extra_data || {};
  
  switch (activity.type) {
    case 'class_checkin':
      if (activity.studios && 'class_name' in metadata && typeof metadata.class_name === 'string') {
        const classMetadata = metadata as ClassActivityDetails;
        return {
          messageParts: [
            { text: `${username} took a `, bold: false, clickable: false },
            { text: `${classMetadata.class_name} `, bold: true, clickable: true },
            { text: 'class at ', bold: false, clickable: false },
            { text: `${activity.studios.name}`, bold: true, clickable: true },
            { text: classMetadata.instructor_name ? ` with ${classMetadata.instructor_name}` : '', bold: true, clickable: true }
          ],
          type: classMetadata.class_name,
          schedule: classMetadata.class_schedule ? new Date(classMetadata.class_schedule).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          }) : null
        };
      }
      break;
      
    case 'studio_favorite':
      if (activity.studios) {
        return {
          messageParts: [
            { text: `${username} added `, bold: false, clickable: false },
            { text: `${activity.studios.name} `, bold: true, clickable: true },
            { text: 'to their favorites', bold: false, clickable: false }
          ],
          type: null,
          schedule: null
        };
      }
      break;
      
    case 'studio_like':
      if (activity.studios) {
        return {
          messageParts: [
            { text: `${username} liked `, bold: false, clickable: false },
            { text: `${activity.studios.name}`, bold: true, clickable: true }
          ],
          type: null,
          schedule: null
        };
      }
      break;
      
    case 'class_transfer':
      if (activity.studios && 'class_name' in metadata && typeof metadata.class_name === 'string') {
        const classMetadata = metadata as ClassActivityDetails;
        return {
          messageParts: [
            { text: 'New Transfer Available: ', bold: true, clickable: true },
            { text: `${username} gave up their spot for `, bold: false, clickable: false },
            { text: `${classMetadata.class_name} `, bold: false, clickable: false },
            { text: 'at ', bold: false, clickable: false },
            { text: `${activity.studios.name}. `, bold: true, clickable: true },
            { text: 'Feel free to take it!', bold: false, clickable: false }
          ],
          type: classMetadata.class_name,
          schedule: classMetadata.class_schedule ? new Date(classMetadata.class_schedule).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          }) : null,
          buttonLabel: 'Claim'
        };
      }
      break;

    case 'wants_to_try':
      if (activity.studios) {
        return {
          messageParts: [
            { text: `${username} wants to try `, bold: false, clickable: false },
            { text: `${activity.studios.name}`, bold: true, clickable: true }
          ],
          type: null,
          schedule: null
        };
      }
      break;
      
    case 'general_post':
    default:
      const postMetadata = metadata as PostActivityDetails;
      return {
        messageParts: [
          { text: postMetadata.message || postMetadata.title || 'Posted an update', bold: false, clickable: false }
        ],
        type: null,
        schedule: null
      };
  }
  
  // Fallback
  const fallbackMetadata = metadata as PostActivityDetails;
  return {
    messageParts: [
      { text: fallbackMetadata.message || fallbackMetadata.title || 'Posted an update', bold: false, clickable: false }
    ],
    type: null,
    schedule: null
  };
}

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'Now';
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

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
      console.error('Feed API: Authentication failed:', authError?.message);
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    // Get the user's friends (accepted friendships) if friendships table exists
    const { data: friendships } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('status', 'accepted');

    // For demo purposes, if no friends exist or friendships table doesn't exist, show sample activities from all users
    const friendIds = friendships?.map(f => f.friend_id) || [];
    let userIds = friendIds;
    
    if (userIds.length === 0) {
      // Get some sample users for demo
      const { data: sampleUsers } = await supabase
        .from('users')
        .select('id')
        .neq('id', user.id)
        .limit(5);
      
      userIds = sampleUsers?.map(u => u.id) || [];
    }

    if (userIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Fetch activity feed from friends
    const { data: activities, error: activitiesError } = await supabase
      .from('activity_feed')
      .select(`
        id,
        user_id,
        type,
        studio_id,
        extra_data,
        created_at,
        users (
          id,
          username,
          full_name,
          avatar_url
        ),
        studios (
          id,
          name,
          address
        )
      `)
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(20);

    if (activitiesError) {
      console.error('Feed API: Error fetching activities:', activitiesError);
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      );
    }

    // Transform activities for frontend
    const transformedActivities = (activities as unknown as ActivityFeedItem[])?.map(activity => {
      const formatted = formatActivityMessage(activity);
      const extraData = activity.extra_data || {};
      
      return {
        id: activity.id,
        avatarUrl: activity.users?.avatar_url || '',
        username: activity.users?.username || '',
        fullName: activity.users?.full_name || '',
        messageParts: formatted.messageParts,
        schedule: formatted.schedule,
        type: formatted.type,
        location: activity.studios?.name || '',
        instructor: 'instructor_name' in extraData ? extraData.instructor_name || '' : '',
        timestamp: getRelativeTime(activity.created_at),
        buttonLabel: formatted.buttonLabel || undefined,
        likeCount: 'like_count' in extraData ? extraData.like_count || 0 : 0,
        activity_type: activity.type,
        image: 'image_url' in extraData && extraData.image_url ? { uri: extraData.image_url } : undefined
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: transformedActivities,
    });

  } catch (error) {
    console.error('Activity feed API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 