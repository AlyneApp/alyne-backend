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
  extra_data: ActivityMetadata;
  collaboration_partners: string[] | null;
  like_count: number;
  comment_count: number;
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

async function formatActivityMessage(activity: ActivityFeedItem, isOwnActivity: boolean = false): Promise<FormattedActivity> {
  const username = isOwnActivity ? 'You' : (activity.users?.full_name || activity.users?.username || 'Someone');
  const metadata = activity.extra_data || {};
  
  switch (activity.type) {
    case 'class_checkin':
      if (activity.studios && 'class_name' in metadata && typeof metadata.class_name === 'string') {
        const classMetadata = metadata as ClassActivityDetails;
        
        if (activity.collaboration_partners && activity.collaboration_partners.length > 0) {
          const { data: partnerUsers } = await supabase
            .from('users')
            .select('full_name, username')
            .in('id', activity.collaboration_partners);
          
          const partnerNames = partnerUsers?.map(user => 
            user.full_name || user.username || 'Someone'
          ).join(', ') || 'Partners';
          
          return {
            messageParts: [
              { text: 'Getting stronger together! ', bold: false, clickable: false },
              { text: `${username} `, bold: true, clickable: true },
              { text: 'just checked in for ', bold: false, clickable: false },
              { text: `${classMetadata.class_name} `, bold: true, clickable: true },
              { text: 'at ', bold: false, clickable: false },
              { text: `${activity.studios.name} `, bold: true, clickable: true },
              { text: 'with ', bold: false, clickable: false },
              { text: `${partnerNames}`, bold: true, clickable: true },
              { text: '.', bold: false, clickable: false }
            ],
            type: classMetadata.class_name,
            schedule: classMetadata.class_schedule ? new Date(classMetadata.class_schedule).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            }) : null
          };
        } else {
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
      }
      
      if ('activity_name' in metadata || 'activity_type' in metadata) {
        const activityName = String((metadata as Record<string, unknown>).activity_name || (metadata as Record<string, unknown>).activity_type || 'a workout');
        
        if (activity.collaboration_partners && activity.collaboration_partners.length > 0) {
          const { data: partnerUsers } = await supabase
            .from('users')
            .select('full_name, username')
            .in('id', activity.collaboration_partners);
          
          const partnerNames = partnerUsers?.map(user => 
            user.full_name || user.username || 'Someone'
          ).join(', ') || 'Partners';
          
          return {
            messageParts: [
              { text: 'Getting stronger together! ', bold: false, clickable: false },
              { text: `${username} `, bold: true, clickable: true },
              { text: 'just checked in for ', bold: false, clickable: false },
              { text: `${activityName} `, bold: true, clickable: true },
              { text: 'with ', bold: false, clickable: false },
              { text: `${partnerNames}`, bold: true, clickable: true },
              { text: '.', bold: false, clickable: false }
            ],
            type: activityName,
            schedule: null
          };
        } else {
          return {
            messageParts: [
              { text: `${username} checked in for `, bold: false, clickable: false },
              { text: `${activityName}`, bold: true, clickable: true }
            ],
            type: activityName,
            schedule: null
          };
        }
      }
      break;
      
    case 'studio_favorite':
      if (activity.studios) {
        return {
          messageParts: [
            { text: `${username} liked `, bold: false, clickable: false },
            { text: `${activity.studios.name}`, bold: true, clickable: true },
            { text: '.', bold: false, clickable: false }
          ],
          type: 'studio_favorite',
          schedule: null
        };
      }
      break;

    case 'post':
      if ('message' in metadata && typeof metadata.message === 'string') {
        const postMetadata = metadata as PostActivityDetails;
        return {
          messageParts: [
            { text: `${username} posted: `, bold: false, clickable: false },
            { text: `"${postMetadata.message}"`, bold: true, clickable: false }
          ],
          type: 'post',
          schedule: null
        };
      }
      break;

    case 'booking_transfer':
      return {
        messageParts: [
          { text: 'New Transfer Available: ', bold: true, clickable: false },
          { text: `${username} gave up your spot for `, bold: false, clickable: false },
          { text: `${'class_name' in metadata ? metadata.class_name : 'a class'} `, bold: true, clickable: true },
          { text: 'at ', bold: false, clickable: false },
          { text: `${activity.studios?.name || 'a studio'}`, bold: true, clickable: true },
          { text: '.', bold: false, clickable: false }
        ],
        type: 'booking_transfer',
        schedule: null,
        buttonLabel: 'Claim'
      };

    case 'wellness_event':
      if ('title' in metadata && typeof metadata.title === 'string') {
        const eventMetadata = metadata as PostActivityDetails;
        return {
          messageParts: [
            { text: `${username} attended `, bold: false, clickable: false },
            { text: `${eventMetadata.title}`, bold: true, clickable: true },
            { text: '.', bold: false, clickable: false }
          ],
          type: 'wellness_event',
          schedule: null
        };
      }
      break;

    case 'wellness_practice':
      if ('title' in metadata && typeof metadata.title === 'string') {
        const practiceMetadata = metadata as PostActivityDetails;
        return {
          messageParts: [
            { text: `${username} completed `, bold: false, clickable: false },
            { text: `${practiceMetadata.title}`, bold: true, clickable: true },
            { text: '.', bold: false, clickable: false }
          ],
          type: 'wellness_practice',
          schedule: null
        };
      }
      break;
  }

  // Default fallback
  return {
    messageParts: [
      { text: `${username} did something`, bold: false, clickable: false }
    ],
    type: activity.type,
    schedule: null
  };
}

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}

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
    const targetUserId = id;
    const isOwnActivity = user.id === targetUserId;

    const { data: activities, error: activitiesError } = await supabase
      .from('activity_feed')
      .select(`
        id,
        user_id,
        type,
        studio_id,
        extra_data,
        collaboration_partners,
        like_count,
        comment_count,
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
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (activitiesError) {
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      );
    }

    const transformedActivities = await Promise.all((activities as unknown as ActivityFeedItem[])?.map(async (activity) => {
      const formatted = await formatActivityMessage(activity, isOwnActivity);
      const extraData = activity.extra_data || {};
      
      return {
        id: activity.id,
        userId: activity.user_id,
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
        likeCount: activity.like_count || 0,
        commentCount: activity.comment_count || 0,
        activity_type: activity.type,
        collaborationPartners: activity.collaboration_partners || [],
        image: 'image_url' in extraData && extraData.image_url ? { uri: extraData.image_url } : undefined,
        routeData: 'route_data' in extraData ? extraData.route_data : undefined,
        distance: 'distance' in extraData ? extraData.distance : undefined,
        duration: 'duration' in extraData ? extraData.duration : undefined
      };
    }) || []);

    return NextResponse.json({
      success: true,
      data: transformedActivities,
    });

  } catch (error) {
    console.error('Error fetching user activity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
