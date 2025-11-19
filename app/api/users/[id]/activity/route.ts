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
      if (activity.studios && 'class_name' in metadata && typeof metadata.class_name === 'string' && 
          !['Custom', 'Custom Class', 'Activity'].includes(metadata.class_name)) {
        const classMetadata = metadata as any;
        
        if (activity.collaboration_partners && activity.collaboration_partners.length > 0) {
          const { data: partnerUsers } = await supabase
            .from('users')
            .select('full_name, username')
            .in('id', activity.collaboration_partners);
          
          const partnerNames = partnerUsers?.map(user => 
            user.full_name || user.username || 'Someone'
          ) || [];
          
          if (partnerNames.length === 1) {
            if (isOwnActivity) {
              // With Another User (You + Others)
              return {
                messageParts: [
                  { text: 'You and ', bold: false, clickable: false },
                  { text: `${partnerNames[0]} `, bold: true, clickable: true },
                  { text: 'did a ', bold: false, clickable: false },
                  { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                  { text: 'class at ', bold: false, clickable: false },
                  { text: `${activity.studios.name}`, bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? ` taught by ` : '', bold: false, clickable: false },
                  { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
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
              // With Another User (Others Only)
              return {
                messageParts: [
                  { text: `${username} `, bold: true, clickable: true },
                  { text: 'and ', bold: false, clickable: false },
                  { text: `${partnerNames[0]} `, bold: true, clickable: true },
                  { text: 'did a ', bold: false, clickable: false },
                  { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                  { text: 'class at ', bold: false, clickable: false },
                  { text: `${activity.studios.name}`, bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? ` taught by ` : '', bold: false, clickable: false },
                  { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
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
          } else if (partnerNames.length === 2) {
            if (isOwnActivity) {
              // Group Class Attendance (You in Group) - 2 partners
              return {
                messageParts: [
                  { text: 'You did ', bold: false, clickable: false },
                  { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                  { text: 'at ', bold: false, clickable: false },
                  { text: `${activity.studios.name} `, bold: true, clickable: true },
                  { text: 'with ', bold: false, clickable: false },
                  { text: `${partnerNames[0]}, ${partnerNames[1]}`, bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? `, taught by ` : '', bold: false, clickable: false },
                  { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
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
              // Group Class Attendance (Others Only) - 2 partners
              return {
                messageParts: [
                  { text: `${username}, `, bold: true, clickable: true },
                  { text: `${partnerNames[0]}, `, bold: true, clickable: true },
                  { text: 'and ', bold: false, clickable: false },
                  { text: `${partnerNames[1]} `, bold: true, clickable: true },
                  { text: 'did a ', bold: false, clickable: false },
                  { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                  { text: 'class at ', bold: false, clickable: false },
                  { text: `${activity.studios.name}`, bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? ` taught by ` : '', bold: false, clickable: false },
                  { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
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
            if (isOwnActivity) {
              // Group Class Attendance (You in Group) - 3+ partners
              const firstTwo = partnerNames.slice(0, 2).join(', ');
              const remaining = partnerNames.length - 2;
              return {
                messageParts: [
                  { text: 'You did ', bold: false, clickable: false },
                  { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                  { text: 'at ', bold: false, clickable: false },
                  { text: `${activity.studios.name} `, bold: true, clickable: true },
                  { text: 'with ', bold: false, clickable: false },
                  { text: `${firstTwo}, and ${remaining} other${remaining > 1 ? 's' : ''}`, bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? `, taught by ` : '', bold: false, clickable: false },
                  { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
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
                  { text: `${username}, `, bold: true, clickable: true },
                  { text: `${firstTwo}, `, bold: true, clickable: true },
                  { text: 'and ', bold: false, clickable: false },
                  { text: `${remaining} other${remaining > 1 ? 's' : ''} `, bold: true, clickable: true },
                  { text: 'did a ', bold: false, clickable: false },
                  { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                  { text: 'class at ', bold: false, clickable: false },
                  { text: `${activity.studios.name}`, bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? ` taught by ` : '', bold: false, clickable: false },
                  { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
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
        } else {
          if (isOwnActivity) {
            // Solo Attendance (You)
            return {
              messageParts: [
                { text: 'You did a ', bold: false, clickable: false },
                { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                { text: 'class at ', bold: false, clickable: false },
                { text: `${activity.studios.name}`, bold: true, clickable: true },
                { text: classMetadata.instructor_name ? ` taught by ` : '', bold: false, clickable: false },
                { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
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
            // Solo Attendance (Others)
            return {
              messageParts: [
                { text: `${username} `, bold: true, clickable: true },
                { text: 'did a ', bold: false, clickable: false },
                { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                { text: 'class at ', bold: false, clickable: false },
                { text: `${activity.studios.name}`, bold: true, clickable: true },
                { text: classMetadata.instructor_name ? ` taught by ` : '', bold: false, clickable: false },
                { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
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
      }
      
      if ('activity_name' in metadata || 'activity_type' in metadata) {
        const activityName = String((metadata as Record<string, unknown>).activity_name || (metadata as Record<string, unknown>).activity_type || 'a workout');
        const classMetadata = metadata as any;
        
        if (activity.collaboration_partners && activity.collaboration_partners.length > 0) {
          const { data: partnerUsers } = await supabase
            .from('users')
            .select('full_name, username')
            .in('id', activity.collaboration_partners);
          
          const partnerNames = partnerUsers?.map(user => 
            user.full_name || user.username || 'Someone'
          ) || [];
          
          // Determine the correct terminology based on activity_type
          const activityType = metadata.activity_type || 'movement';
          let activityTerm = 'workout';
          
          // Only use "workout" for movement activities, otherwise just the activity name
          if (activityType !== 'movement') {
            activityTerm = '';
          }
          
          if (partnerNames.length === 1) {
            if (isOwnActivity) {
              return {
                messageParts: [
                  { text: 'You and ', bold: false, clickable: false },
                  { text: `${partnerNames[0]} `, bold: true, clickable: true },
                  { text: 'did a ', bold: false, clickable: false },
                  { text: `${activityName}`, bold: true, clickable: true },
                  { text: activityTerm ? ` ${activityTerm}` : '', bold: false, clickable: false },
                  { text: classMetadata.class_name ? ` (${classMetadata.class_name})` : '', bold: false, clickable: false },
                  { text: activity.studios?.name ? ` at ` : '', bold: false, clickable: false },
                  { text: activity.studios?.name || '', bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? ` with ` : '', bold: false, clickable: false },
                  { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
                  { text: '.', bold: false, clickable: false }
                ],
                type: activityName,
                schedule: null
              };
            } else {
              return {
                messageParts: [
                  { text: `${username} and ${partnerNames[0]} did a `, bold: false, clickable: false },
                  { text: `${activityName}`, bold: true, clickable: true },
                  { text: activityTerm ? ` ${activityTerm}` : '', bold: false, clickable: false },
                  { text: classMetadata.class_name ? ` (${classMetadata.class_name})` : '', bold: false, clickable: false },
                  { text: activity.studios?.name ? ` at ` : '', bold: false, clickable: false },
                  { text: activity.studios?.name || '', bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? ` with ` : '', bold: false, clickable: false },
                  { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
                  { text: '.', bold: false, clickable: false }
                ],
                type: activityName,
                schedule: null
              };
            }
          } else if (partnerNames.length === 2) {
            if (isOwnActivity) {
              return {
                messageParts: [
                  { text: 'You did a ', bold: false, clickable: false },
                  { text: `${activityName} `, bold: true, clickable: true },
                  { text: activityTerm ? `${activityTerm}` : '', bold: false, clickable: false },
                  { text: classMetadata.class_name ? ` (${classMetadata.class_name})` : '', bold: false, clickable: false },
                  { text: ` with `, bold: false, clickable: false },
                  { text: `${partnerNames[0]}, ${partnerNames[1]}`, bold: true, clickable: true },
                  { text: activity.studios?.name ? ` at ` : '', bold: false, clickable: false },
                  { text: activity.studios?.name || '', bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? ` with ` : '', bold: false, clickable: false },
                  { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
                  { text: '.', bold: false, clickable: false }
                ],
                type: activityName,
                schedule: null
              };
            } else {
              return {
                messageParts: [
                  { text: `${username}, ${partnerNames[0]}, and ${partnerNames[1]} did a `, bold: false, clickable: false },
                  { text: `${activityName}`, bold: true, clickable: true },
                  { text: activityTerm ? ` ${activityTerm}` : '', bold: false, clickable: false },
                  { text: classMetadata.class_name ? ` (${classMetadata.class_name})` : '', bold: false, clickable: false },
                  { text: activity.studios?.name ? ` at ` : '', bold: false, clickable: false },
                  { text: activity.studios?.name || '', bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? ` with ` : '', bold: false, clickable: false },
                  { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
                  { text: '.', bold: false, clickable: false }
                ],
                type: activityName,
                schedule: null
              };
            }
          } else {
            const firstTwo = partnerNames.slice(0, 2).join(', ');
            const remaining = partnerNames.length - 2;
            if (isOwnActivity) {
              return {
                messageParts: [
                  { text: 'You did a ', bold: false, clickable: false },
                  { text: `${activityName} `, bold: true, clickable: true },
                  { text: activityTerm ? `${activityTerm}` : '', bold: false, clickable: false },
                  { text: classMetadata.class_name ? ` (${classMetadata.class_name})` : '', bold: false, clickable: false },
                  { text: ` with `, bold: false, clickable: false },
                  { text: `${firstTwo}, and ${remaining} other${remaining > 1 ? 's' : ''}`, bold: true, clickable: true },
                  { text: activity.studios?.name ? ` at ` : '', bold: false, clickable: false },
                  { text: activity.studios?.name || '', bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? ` with ` : '', bold: false, clickable: false },
                  { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
                  { text: '.', bold: false, clickable: false }
                ],
                type: activityName,
                schedule: null
              };
            } else {
              return {
                messageParts: [
                  { text: `${username}, ${firstTwo}, and ${remaining} other${remaining > 1 ? 's' : ''} did a `, bold: false, clickable: false },
                  { text: `${activityName}`, bold: true, clickable: true },
                  { text: activityTerm ? ` ${activityTerm}` : '', bold: false, clickable: false },
                  { text: classMetadata.class_name ? ` (${classMetadata.class_name})` : '', bold: false, clickable: false },
                  { text: activity.studios?.name ? ` at ` : '', bold: false, clickable: false },
                  { text: activity.studios?.name || '', bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? ` with ` : '', bold: false, clickable: false },
                  { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
                  { text: '.', bold: false, clickable: false }
                ],
                type: activityName,
                schedule: null
              };
            }
          }
        } else {
          // Determine the correct terminology based on activity_type
          const activityType = metadata.activity_type || 'movement';
          let activityTerm = 'workout';
          
          // Only use "workout" for movement activities, otherwise just the activity name
          if (activityType !== 'movement') {
            activityTerm = '';
          }
          
          if (isOwnActivity) {
            return {
              messageParts: [
                { text: 'You did a ', bold: false, clickable: false },
                { text: `${activityName}`, bold: true, clickable: true },
                { text: activityTerm ? ` ${activityTerm}` : '', bold: false, clickable: false },
                { text: classMetadata.class_name ? ` (${classMetadata.class_name})` : '', bold: false, clickable: false },
                { text: activity.studios?.name ? ` at ` : '', bold: false, clickable: false },
                { text: activity.studios?.name || '', bold: true, clickable: true },
                { text: classMetadata.instructor_name ? ` with ` : '', bold: false, clickable: false },
                { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
                { text: '.', bold: false, clickable: false }
              ],
              type: activityName,
              schedule: null
            };
          } else {
            return {
              messageParts: [
                { text: `${username} did a `, bold: false, clickable: false },
                { text: `${activityName}`, bold: true, clickable: true },
                { text: activityTerm ? ` ${activityTerm}` : '', bold: false, clickable: false },
                { text: classMetadata.class_name ? ` (${classMetadata.class_name})` : '', bold: false, clickable: false },
                { text: activity.studios?.name ? ` at ` : '', bold: false, clickable: false },
                { text: activity.studios?.name || '', bold: true, clickable: true },
                { text: classMetadata.instructor_name ? ` with ` : '', bold: false, clickable: false },
                { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
                { text: '.', bold: false, clickable: false }
              ],
              type: activityName,
              schedule: null
            };
          }
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
    
    // Check if current user can view the target user's content
    if (!isOwnActivity) {
      // Get target user's privacy settings
      const { data: targetUser, error: userError } = await supabase
        .from('users')
        .select('is_private')
        .eq('id', targetUserId)
        .single();

      if (userError || !targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // If user is private, check if current user follows them
      if (targetUser.is_private) {
        const { data: followData } = await supabase
          .from('friends')
          .select('approved')
          .eq('user_id', user.id)
          .eq('friend_id', targetUserId)
          .single();

        const isFollowing = !!followData?.approved;
        
        if (!isFollowing) {
          return NextResponse.json({ 
            error: 'This account is private. Follow to see their activity.',
            can_view_content: false 
          }, { status: 403 });
        }
      }
    }
    
    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '8');
    const offset = (page - 1) * limit;

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
        moderation_status,
        users!activity_feed_user_id_fkey (
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
      // Only show approved content (or pending if moderation hasn't run yet)
      .or('moderation_status.is.null,moderation_status.eq.approved,moderation_status.eq.pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (activitiesError) {
      console.error('❌ User Activity API - Error fetching activities:', activitiesError);
      console.error('❌ Error details:', JSON.stringify(activitiesError, null, 2));
      return NextResponse.json(
        { error: 'Failed to fetch activities', details: activitiesError.message || String(activitiesError) },
        { status: 500 }
      );
    }

    // Get actual like counts from activity_feed_likes table
    const activityIds = activities?.map(activity => activity.id) || [];
    const { data: likeCounts } = await supabase
      .from('activity_feed_likes')
      .select('activity_id')
      .in('activity_id', activityIds);

    // Count likes per activity
    const actualLikeCounts = new Map();
    likeCounts?.forEach(like => {
      const currentCount = actualLikeCounts.get(like.activity_id);
      actualLikeCounts.set(like.activity_id, (currentCount || 0) + 1);
    });

    console.log('📊 Actual like counts from database:', Array.from(actualLikeCounts.entries()));

    const transformedActivities = await Promise.all((activities as unknown as ActivityFeedItem[])?.map(async (activity) => {
      const formatted = await formatActivityMessage(activity, isOwnActivity);
      const extraData = activity.extra_data || {};
      
      // Debug logging for images
      if ((extraData as any).photos || (extraData as any).image_url) {
        console.log('📸 User Activity API - Activity with images:', {
          id: activity.id,
          hasPhotos: !!(extraData as any).photos,
          photosCount: Array.isArray((extraData as any).photos) ? (extraData as any).photos.length : 0,
          hasImageUrl: !!(extraData as any).image_url,
          imageUrl: (extraData as any).image_url,
          photos: (extraData as any).photos
        });
      }
      
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
        studioId: activity.studios?.id || null,
        instructor: 'instructor_name' in extraData ? extraData.instructor_name || '' : '',
        instructorId: 'instructor_id' in extraData ? extraData.instructor_id || null : null,
        timestamp: getRelativeTime(activity.created_at),
        buttonLabel: formatted.buttonLabel || undefined,
        likeCount: actualLikeCounts.get(activity.id) || 0,
        commentCount: activity.comment_count || 0,
        activity_type: activity.type,
        collaborationPartners: activity.collaboration_partners || [],
        partnerNames: activity.collaboration_partners && activity.collaboration_partners.length > 0 ? 
          (await supabase
            .from('users')
            .select('full_name, username, id')
            .in('id', activity.collaboration_partners)
            .then(({ data }) => data?.map(user => ({
              id: user.id,
              name: user.full_name || user.username || 'Someone'
            })) || [])) : [],
        image: 'image_url' in extraData && extraData.image_url ? { uri: extraData.image_url } : 
               'photos' in extraData && Array.isArray(extraData.photos) && extraData.photos.length > 0 ? { uri: extraData.photos[0] } : undefined,
        photos: 'photos' in extraData && Array.isArray(extraData.photos) && extraData.photos.length > 0 
          ? extraData.photos.map((url: string) => ({ uri: url })) 
          : undefined,
        routeData: 'route_data' in extraData ? extraData.route_data : undefined,
        distance: 'distance' in extraData ? extraData.distance : undefined,
        duration: 'duration' in extraData ? extraData.duration : undefined,
        howItWent: 'how_it_went' in extraData ? extraData.how_it_went || null : null
      };
    }) || []);

    // Check if there are more pages
    const hasMore = transformedActivities.length === limit;
    const nextPage = hasMore ? page + 1 : null;

    return NextResponse.json({
      success: true,
      data: transformedActivities,
      pagination: {
        page,
        limit,
        hasMore,
        nextPage,
        total: transformedActivities.length
      }
    });

  } catch (error) {
    console.error('Error fetching user activity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
