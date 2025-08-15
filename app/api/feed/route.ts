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

async function formatActivityMessage(activity: ActivityFeedItem): Promise<FormattedActivity> {
  const username = activity.users?.full_name || activity.users?.username || 'Someone';
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
          ) || [];
          
          if (partnerNames.length === 1) {
            // With Another User (Others Only)
            return {
              messageParts: [
                { text: `${username} and ${partnerNames[0]} took a `, bold: false, clickable: false },
                { text: `${classMetadata.class_name} `, bold: true, clickable: true },
                { text: 'class at ', bold: false, clickable: false },
                { text: `${activity.studios.name}`, bold: true, clickable: true },
                { text: classMetadata.instructor_name ? ` taught by ${classMetadata.instructor_name}` : '', bold: false, clickable: false },
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
          } else if (partnerNames.length === 2) {
            // Group Class Attendance (Others Only) - 2 partners
            return {
              messageParts: [
                { text: `${username}, ${partnerNames[0]}, and ${partnerNames[1]} took a `, bold: false, clickable: false },
                { text: `${classMetadata.class_name} `, bold: true, clickable: true },
                { text: 'class at ', bold: false, clickable: false },
                { text: `${activity.studios.name}`, bold: true, clickable: true },
                { text: classMetadata.instructor_name ? ` taught by ${classMetadata.instructor_name}` : '', bold: false, clickable: false },
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
            // Group Class Attendance (Others Only) - 3+ partners
            const firstTwo = partnerNames.slice(0, 2).join(', ');
            const remaining = partnerNames.length - 2;
            return {
              messageParts: [
                { text: `${username}, ${firstTwo}, and ${remaining} other${remaining > 1 ? 's' : ''} took a `, bold: false, clickable: false },
                { text: `${classMetadata.class_name} `, bold: true, clickable: true },
                { text: 'class at ', bold: false, clickable: false },
                { text: `${activity.studios.name}`, bold: true, clickable: true },
                { text: classMetadata.instructor_name ? ` taught by ${classMetadata.instructor_name}` : '', bold: false, clickable: false },
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
          }
        } else {
          // Solo Attendance (Others)
          return {
            messageParts: [
              { text: `${username} took a `, bold: false, clickable: false },
              { text: `${classMetadata.class_name} `, bold: true, clickable: true },
              { text: 'class at ', bold: false, clickable: false },
              { text: `${activity.studios.name}`, bold: true, clickable: true },
              { text: classMetadata.instructor_name ? ` taught by ${classMetadata.instructor_name}` : '', bold: false, clickable: false },
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
          ) || [];
          
          if (partnerNames.length === 1) {
            return {
              messageParts: [
                { text: `${username} and ${partnerNames[0]} did `, bold: false, clickable: false },
                { text: `${activityName}`, bold: true, clickable: true },
                { text: '.', bold: false, clickable: false }
              ],
              type: activityName,
              schedule: null
            };
          } else if (partnerNames.length === 2) {
            return {
              messageParts: [
                { text: `${username}, ${partnerNames[0]}, and ${partnerNames[1]} did `, bold: false, clickable: false },
                { text: `${activityName}`, bold: true, clickable: true },
                { text: '.', bold: false, clickable: false }
              ],
              type: activityName,
              schedule: null
            };
          } else {
            const firstTwo = partnerNames.slice(0, 2).join(', ');
            const remaining = partnerNames.length - 2;
            return {
              messageParts: [
                { text: `${username}, ${firstTwo}, and ${remaining} other${remaining > 1 ? 's' : ''} did `, bold: false, clickable: false },
                { text: `${activityName}`, bold: true, clickable: true },
                { text: '.', bold: false, clickable: false }
              ],
              type: activityName,
              schedule: null
            };
          }
        } else {
          return {
            messageParts: [
              { text: `${username} did `, bold: false, clickable: false },
              { text: `${activityName}`, bold: true, clickable: true },
              { text: '.', bold: false, clickable: false }
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
      const postMetadata = metadata as PostActivityDetails;
      
      if (activity.collaboration_partners && activity.collaboration_partners.length > 0) {
        const { data: partnerUsers } = await supabase
          .from('users')
          .select('full_name, username')
          .in('id', activity.collaboration_partners);
        
        const partnerNames = partnerUsers?.map(user => 
          user.full_name || user.username || 'Someone'
        ) || [];
        
        if (partnerNames.length === 1) {
          return {
            messageParts: [
              { text: `${username} and ${partnerNames[0]} did `, bold: false, clickable: false },
              { text: `${postMetadata.title || 'a workout'} `, bold: true, clickable: true },
              { text: 'at ', bold: false, clickable: false },
              { text: `${activity.studios?.name || 'the studio'}`, bold: true, clickable: true },
              { text: '.', bold: false, clickable: false }
            ],
            type: postMetadata.title || null,
            schedule: null
          };
        } else if (partnerNames.length === 2) {
          return {
            messageParts: [
              { text: `${username}, ${partnerNames[0]}, and ${partnerNames[1]} did `, bold: false, clickable: false },
              { text: `${postMetadata.title || 'a workout'} `, bold: true, clickable: true },
              { text: 'at ', bold: false, clickable: false },
              { text: `${activity.studios?.name || 'the studio'}`, bold: true, clickable: true },
              { text: '.', bold: false, clickable: false }
            ],
            type: postMetadata.title || null,
            schedule: null
          };
        } else {
          const firstTwo = partnerNames.slice(0, 2).join(', ');
          const remaining = partnerNames.length - 2;
          return {
            messageParts: [
              { text: `${username}, ${firstTwo}, and ${remaining} other${remaining > 1 ? 's' : ''} did `, bold: false, clickable: false },
              { text: `${postMetadata.title || 'a workout'} `, bold: true, clickable: true },
              { text: 'at ', bold: false, clickable: false },
              { text: `${activity.studios?.name || 'the studio'}`, bold: true, clickable: true },
              { text: '.', bold: false, clickable: false }
            ],
            type: postMetadata.title || null,
            schedule: null
          };
        }
      } else {
        return {
          messageParts: [
            { text: `${username} posted: `, bold: false, clickable: false },
            { text: postMetadata.message || postMetadata.title || 'an update', bold: true, clickable: false }
          ],
          type: null,
          schedule: null
        };
      }
  
    default:
      const fallbackMetadata = metadata as PostActivityDetails;
      return {
        messageParts: [
          { text: fallbackMetadata.message || fallbackMetadata.title || 'Posted an update', bold: false, clickable: false }
        ],
        type: null,
        schedule: null
      };
  }
  
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
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    // Only get users that YOU follow (not users who follow you)
    const { data: friends } = await supabase
      .from('friends')
      .select('user_id, friend_id')
      .eq('approved', true)
      .eq('user_id', user.id); // Only get friendships where YOU are the user_id (you follow them)

    const friendIds = new Set<string>();
    friends?.forEach(friendship => {
      friendIds.add(friendship.friend_id);
    });

    const friendIdsArray = Array.from(friendIds);
    
    if (friendIdsArray.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

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
      .in('user_id', friendIdsArray)
      .order('created_at', { ascending: false })
      .limit(20);

    if (activitiesError) {
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      );
    }

    const transformedActivities = await Promise.all((activities as unknown as ActivityFeedItem[])?.map(async (activity) => {
      const formatted = await formatActivityMessage(activity);
      const extraData = activity.extra_data || {};
      
      return {
        id: activity.id,
        userId: activity.user_id, // Add user ID for navigation
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

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 