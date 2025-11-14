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
  photos?: string[];
  image_url?: string;
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

// Helper function to get studio name (from join or extra_data)
function getStudioName(activity: ActivityFeedItem): string {
  return activity.studios?.name || (activity.extra_data as any)?.studio_name || 'Unknown Studio';
}

// Helper function to get special phrasing for running, walking, and cycling
function getSpecialActivityPhrase(activityName: string): { verb: string; activity: string } | null {
  const normalizedName = activityName.toLowerCase().trim();
  if (normalizedName === 'running') {
    return { verb: 'went for a', activity: 'run' };
  } else if (normalizedName === 'walking') {
    return { verb: 'went for a', activity: 'walk' };
  } else if (normalizedName === 'cycling') {
    return { verb: 'went for a', activity: 'bike ride' };
  }
  return null;
}

async function formatActivityMessage(activity: ActivityFeedItem, currentUserId?: string): Promise<FormattedActivity> {
  const username = activity.users?.full_name || activity.users?.username || 'Someone';
  const metadata = activity.extra_data || {};
  const isOwnActivity = currentUserId && activity.user_id === currentUserId;
  
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
                  { text: 'took a ', bold: false, clickable: false },
                  { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                  { text: 'class at ', bold: false, clickable: false },
                  { text: `${getStudioName(activity)}`, bold: true, clickable: true },
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
                  { text: 'took a ', bold: false, clickable: false },
                  { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                  { text: 'class at ', bold: false, clickable: false },
                  { text: `${getStudioName(activity)}`, bold: true, clickable: true },
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
                  { text: 'You took ', bold: false, clickable: false },
                  { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                  { text: 'at ', bold: false, clickable: false },
                  { text: `${getStudioName(activity)} `, bold: true, clickable: true },
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
                  { text: 'took a ', bold: false, clickable: false },
                  { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                  { text: 'class at ', bold: false, clickable: false },
                  { text: `${getStudioName(activity)}`, bold: true, clickable: true },
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
                  { text: 'You took ', bold: false, clickable: false },
                  { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                  { text: 'at ', bold: false, clickable: false },
                  { text: `${getStudioName(activity)} `, bold: true, clickable: true },
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
                  { text: 'took a ', bold: false, clickable: false },
                  { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                  { text: 'class at ', bold: false, clickable: false },
                  { text: `${getStudioName(activity)}`, bold: true, clickable: true },
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
                { text: 'You took a ', bold: false, clickable: false },
                { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                { text: 'class at ', bold: false, clickable: false },
                { text: `${getStudioName(activity)}`, bold: true, clickable: true },
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
                { text: 'took a ', bold: false, clickable: false },
                { text: `${classMetadata.class_name} `, bold: false, clickable: false },
                { text: 'class at ', bold: false, clickable: false },
                { text: `${getStudioName(activity)}`, bold: true, clickable: true },
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
        const specialPhrase = getSpecialActivityPhrase(activityName);
        
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
          const isPractice = activityType === 'practice';
          
          // Only use "workout" for movement activities, otherwise just the activity name
          if (activityType !== 'movement') {
            activityTerm = '';
          }
          
          if (partnerNames.length === 1) {
            if (isOwnActivity) {
              // With Another User (You + Others)
              if (specialPhrase) {
                // Special phrase for running/walking/cycling: "went for a run/walk/bike ride"
                return {
                  messageParts: [
                    { text: 'You and ', bold: false, clickable: false },
                    { text: `${partnerNames[0]} `, bold: true, clickable: true },
                    { text: `${specialPhrase.verb} `, bold: false, clickable: false },
                    { text: `${specialPhrase.activity}`, bold: true, clickable: true },
                    { text: '.', bold: false, clickable: false }
                  ],
                  type: activityName,
                  schedule: null
                };
              } else if (isPractice) {
                // Practice format: "did a <class_name> <activityName> at <studio> by <instructor>"
                // Partner is already included in "You and <partner>"
                return {
                  messageParts: [
                    { text: 'You and ', bold: false, clickable: false },
                    { text: `${partnerNames[0]} `, bold: true, clickable: true },
                    { text: 'did a ', bold: false, clickable: false },
                    { text: classMetadata.class_name ? `${classMetadata.class_name} ` : '', bold: false, clickable: false },
                    { text: `${activityName}`, bold: true, clickable: true },
                    { text: getStudioName(activity) ? ` at ` : '', bold: false, clickable: false },
                    { text: getStudioName(activity) || '', bold: true, clickable: true },
                    { text: classMetadata.instructor_name ? ` by ` : '', bold: false, clickable: false },
                    { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
                    { text: '.', bold: false, clickable: false }
                  ],
                  type: activityName,
                  schedule: null
                };
              } else {
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
              }
            } else {
              // With Another User (Others Only)
              if (specialPhrase) {
                // Special phrase for running/walking/cycling: "went for a run/walk/bike ride"
                return {
                  messageParts: [
                    { text: `${username} and ${partnerNames[0]} `, bold: false, clickable: false },
                    { text: `${specialPhrase.verb} `, bold: false, clickable: false },
                    { text: `${specialPhrase.activity}`, bold: true, clickable: true },
                    { text: '.', bold: false, clickable: false }
                  ],
                  type: activityName,
                  schedule: null
                };
              } else if (isPractice) {
                // Practice format: "did a <class_name> <activityName> at <studio> by <instructor> with <partner>"
                return {
                  messageParts: [
                    { text: `${username} and ${partnerNames[0]} did a `, bold: false, clickable: false },
                    { text: classMetadata.class_name ? `${classMetadata.class_name} ` : '', bold: false, clickable: false },
                    { text: `${activityName}`, bold: true, clickable: true },
                    { text: getStudioName(activity) ? ` at ` : '', bold: false, clickable: false },
                    { text: getStudioName(activity) || '', bold: true, clickable: true },
                    { text: classMetadata.instructor_name ? ` by ` : '', bold: false, clickable: false },
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
            }
          } else if (partnerNames.length === 2) {
            if (isOwnActivity) {
              // Group Activity (You in Group) - 2 partners
              if (specialPhrase) {
                return {
                  messageParts: [
                    { text: 'You, ', bold: false, clickable: false },
                    { text: `${partnerNames[0]}, and ${partnerNames[1]} `, bold: true, clickable: true },
                    { text: `${specialPhrase.verb} `, bold: false, clickable: false },
                    { text: `${specialPhrase.activity}`, bold: true, clickable: true },
                    { text: '.', bold: false, clickable: false }
                  ],
                  type: activityName,
                  schedule: null
                };
              } else if (isPractice) {
                return {
                  messageParts: [
                    { text: 'You did a ', bold: false, clickable: false },
                    { text: classMetadata.class_name ? `${classMetadata.class_name} ` : '', bold: false, clickable: false },
                    { text: `${activityName}`, bold: true, clickable: true },
                    { text: getStudioName(activity) ? ` at ` : '', bold: false, clickable: false },
                    { text: getStudioName(activity) || '', bold: true, clickable: true },
                    { text: classMetadata.instructor_name ? ` by ` : '', bold: false, clickable: false },
                    { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
                    { text: ' with ', bold: false, clickable: false },
                    { text: `${partnerNames[0]}, ${partnerNames[1]}`, bold: true, clickable: true },
                    { text: '.', bold: false, clickable: false }
                  ],
                  type: activityName,
                  schedule: null
                };
              } else {
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
              }
            } else {
              // Group Activity (Others Only) - 2 partners
              if (specialPhrase) {
                return {
                  messageParts: [
                    { text: `${username}, ${partnerNames[0]}, and ${partnerNames[1]} `, bold: false, clickable: false },
                    { text: `${specialPhrase.verb} `, bold: false, clickable: false },
                    { text: `${specialPhrase.activity}`, bold: true, clickable: true },
                    { text: '.', bold: false, clickable: false }
                  ],
                  type: activityName,
                  schedule: null
                };
              } else if (isPractice) {
                return {
                  messageParts: [
                    { text: `${username}, ${partnerNames[0]}, and ${partnerNames[1]} did a `, bold: false, clickable: false },
                    { text: classMetadata.class_name ? `${classMetadata.class_name} ` : '', bold: false, clickable: false },
                    { text: `${activityName}`, bold: true, clickable: true },
                    { text: getStudioName(activity) ? ` at ` : '', bold: false, clickable: false },
                    { text: getStudioName(activity) || '', bold: true, clickable: true },
                    { text: classMetadata.instructor_name ? ` by ` : '', bold: false, clickable: false },
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
            }
          } else {
            if (isOwnActivity) {
              // Group Activity (You in Group) - 3+ partners
              const firstTwo = partnerNames.slice(0, 2).join(', ');
              const remaining = partnerNames.length - 2;
              if (specialPhrase) {
                return {
                  messageParts: [
                    { text: 'You, ', bold: false, clickable: false },
                    { text: `${firstTwo}, and ${remaining} other${remaining > 1 ? 's' : ''} `, bold: true, clickable: true },
                    { text: `${specialPhrase.verb} `, bold: false, clickable: false },
                    { text: `${specialPhrase.activity}`, bold: true, clickable: true },
                    { text: '.', bold: false, clickable: false }
                  ],
                  type: activityName,
                  schedule: null
                };
              } else if (isPractice) {
                return {
                  messageParts: [
                    { text: 'You did a ', bold: false, clickable: false },
                    { text: classMetadata.class_name ? `${classMetadata.class_name} ` : '', bold: false, clickable: false },
                    { text: `${activityName}`, bold: true, clickable: true },
                    { text: getStudioName(activity) ? ` at ` : '', bold: false, clickable: false },
                    { text: getStudioName(activity) || '', bold: true, clickable: true },
                    { text: classMetadata.instructor_name ? ` by ` : '', bold: false, clickable: false },
                    { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
                    { text: ' with ', bold: false, clickable: false },
                    { text: `${firstTwo}, and ${remaining} other${remaining > 1 ? 's' : ''}`, bold: true, clickable: true },
                    { text: '.', bold: false, clickable: false }
                  ],
                  type: activityName,
                  schedule: null
                };
              } else {
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
              }
            } else {
              // Group Activity (Others Only) - 3+ partners
              const firstTwo = partnerNames.slice(0, 2).join(', ');
              const remaining = partnerNames.length - 2;
              if (specialPhrase) {
                return {
                  messageParts: [
                    { text: `${username}, ${firstTwo}, and ${remaining} other${remaining > 1 ? 's' : ''} `, bold: false, clickable: false },
                    { text: `${specialPhrase.verb} `, bold: false, clickable: false },
                    { text: `${specialPhrase.activity}`, bold: true, clickable: true },
                    { text: '.', bold: false, clickable: false }
                  ],
                  type: activityName,
                  schedule: null
                };
              } else if (isPractice) {
                return {
                  messageParts: [
                    { text: `${username}, ${firstTwo}, and ${remaining} other${remaining > 1 ? 's' : ''} did a `, bold: false, clickable: false },
                    { text: classMetadata.class_name ? `${classMetadata.class_name} ` : '', bold: false, clickable: false },
                    { text: `${activityName}`, bold: true, clickable: true },
                    { text: getStudioName(activity) ? ` at ` : '', bold: false, clickable: false },
                    { text: getStudioName(activity) || '', bold: true, clickable: true },
                    { text: classMetadata.instructor_name ? ` by ` : '', bold: false, clickable: false },
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
          }
        } else {
          // Determine the correct terminology based on activity_type
          const activityType = metadata.activity_type || 'movement';
          let activityTerm = 'workout';
          const isPractice = activityType === 'practice';
          
          // Only use "workout" for movement activities, otherwise just the activity name
          if (activityType !== 'movement') {
            activityTerm = '';
          }
          
          if (isOwnActivity) {
            // Solo Activity (You)
            if (specialPhrase) {
              // Special phrase for running/walking/cycling: "went for a run/walk/bike ride"
              return {
                messageParts: [
                  { text: 'You ', bold: false, clickable: false },
                  { text: `${specialPhrase.verb} `, bold: false, clickable: false },
                  { text: `${specialPhrase.activity}`, bold: true, clickable: true },
                  { text: '.', bold: false, clickable: false }
                ],
                type: activityName,
                schedule: null
              };
            } else if (isPractice) {
              return {
                messageParts: [
                  { text: 'You did a ', bold: false, clickable: false },
                  { text: classMetadata.class_name ? `${classMetadata.class_name} ` : '', bold: false, clickable: false },
                  { text: `${activityName}`, bold: true, clickable: true },
                  { text: getStudioName(activity) ? ` at ` : '', bold: false, clickable: false },
                  { text: getStudioName(activity) || '', bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? ` by ` : '', bold: false, clickable: false },
                  { text: classMetadata.instructor_name || '', bold: ('instructor_id' in metadata && metadata.instructor_id) ? true : false, clickable: ('instructor_id' in metadata && metadata.instructor_id) ? true : false },
                  { text: '.', bold: false, clickable: false }
                ],
                type: activityName,
                schedule: null
              };
            } else {
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
            }
          } else {
            // Solo Activity (Others)
            if (specialPhrase) {
              // Special phrase for running/walking/cycling: "went for a run/walk/bike ride"
              return {
                messageParts: [
                  { text: `${username} `, bold: false, clickable: false },
                  { text: `${specialPhrase.verb} `, bold: false, clickable: false },
                  { text: `${specialPhrase.activity}`, bold: true, clickable: true },
                  { text: '.', bold: false, clickable: false }
                ],
                type: activityName,
                schedule: null
              };
            } else if (isPractice) {
              return {
                messageParts: [
                  { text: `${username} did a `, bold: false, clickable: false },
                  { text: classMetadata.class_name ? `${classMetadata.class_name} ` : '', bold: false, clickable: false },
                  { text: `${activityName}`, bold: true, clickable: true },
                  { text: getStudioName(activity) ? ` at ` : '', bold: false, clickable: false },
                  { text: getStudioName(activity) || '', bold: true, clickable: true },
                  { text: classMetadata.instructor_name ? ` by ` : '', bold: false, clickable: false },
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
      }
      break;
      
    case 'studio_favorite':
      if (activity.studios) {
        return {
          messageParts: [
            { text: `${username} added `, bold: false, clickable: false },
            { text: `${getStudioName(activity)} `, bold: true, clickable: true },
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
            { text: `${getStudioName(activity)}`, bold: true, clickable: true }
          ],
          type: null,
          schedule: null
        };
      }
      break;
      
    case 'class_transfer':
      if (activity.studios && 'class_name' in metadata && typeof metadata.class_name === 'string') {
        const classMetadata = metadata as any;
        return {
          messageParts: [
            { text: 'New Transfer Available: ', bold: true, clickable: true },
            { text: `${username} gave up their spot for `, bold: false, clickable: false },
            { text: `${classMetadata.class_name} `, bold: false, clickable: false },
            { text: 'at ', bold: false, clickable: false },
            { text: `${getStudioName(activity)}. `, bold: true, clickable: true },
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
            { text: `${getStudioName(activity)}`, bold: true, clickable: true }
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

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '8');
    const offset = (page - 1) * limit;

    // Get users that YOU follow OR who follow YOU (bidirectional friendships)
    // We need to check both directions since friendships can be initiated by either user
    const { data: friends, error: friendsError } = await supabase
      .from('friends')
      .select('user_id, friend_id')
      .eq('approved', true)
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (friendsError) {
      console.error('Error fetching friends:', friendsError);
    }

    console.log(`📊 Feed API - Found ${friends?.length || 0} approved friendships for user ${user.id}`);

    // Use Set to automatically handle duplicates
    const friendIds = new Set<string>();
    friends?.forEach(friendship => {
      if (friendship.user_id === user.id) {
        // You follow them
        friendIds.add(friendship.friend_id);
        console.log(`  → You follow: ${friendship.friend_id}`);
      } else {
        // They follow you
        friendIds.add(friendship.user_id);
        console.log(`  → They follow you: ${friendship.user_id}`);
      }
    });

    // Include your own posts in the feed
    friendIds.add(user.id);

    const friendIdsArray = Array.from(friendIds);
    console.log(`📊 Feed API - Total friend IDs (including self): ${friendIdsArray.length}`, friendIdsArray);
    
    if (friendIdsArray.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          hasMore: false,
          nextPage: null,
          total: 0
        }
      });
    }

    console.log(`📊 Feed API - Querying activities for ${friendIdsArray.length} friend IDs:`, friendIdsArray);
    
    // Get list of blocked user IDs
    const { data: blockedUsers } = await supabase
      .from('blocked_users')
      .select('blocked_user_id')
      .eq('user_id', user.id);
    
    const blockedUserIds = blockedUsers?.map(b => b.blocked_user_id) || [];
    
    // Filter out blocked users from friend IDs
    const filteredFriendIds = friendIdsArray.filter(friendId => !blockedUserIds.includes(friendId));
    
    if (filteredFriendIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          hasMore: false,
          nextPage: null,
          total: 0
        }
      });
    }
    
    console.log(`📊 Feed API - After filtering blocked users: ${filteredFriendIds.length} friend IDs`);
    
    // Build query - filter out rejected content
    let query = supabase
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
      .in('user_id', filteredFriendIds);
    
    // Only show approved content (or pending if moderation hasn't run yet)
    // Exclude rejected content - allow null, approved, or pending
    // Using .or() with PostgREST syntax: column.operator.value,column.operator.value
    query = query.or('moderation_status.is.null,moderation_status.eq.approved,moderation_status.eq.pending');
    
    const { data: activities, error: activitiesError } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    console.log(`📊 Feed API - Found ${activities?.length || 0} activities`);
    if (activities && activities.length > 0) {
      activities.forEach((activity: any) => {
        console.log(`  → Activity ${activity.id} by user ${activity.user_id} (${activity.users?.username || activity.users?.full_name || 'unknown'})`);
      });
    }

    if (activitiesError) {
      console.error('❌ Feed API - Error fetching activities:', activitiesError);
      console.error('❌ Error details:', JSON.stringify(activitiesError, null, 2));
      return NextResponse.json(
        { error: 'Failed to fetch activities', details: activitiesError.message || String(activitiesError) },
        { status: 500 }
      );
    }

    // Fetch ratings for activities (studio, class, instructor)
    const activityIds = activities?.map(activity => activity.id) || [];
    
    let studioRatingsMap = new Map();
    let classRatingsMap = new Map();
    let instructorRatingsMap = new Map();
    
    if (activityIds.length > 0) {
      // Fetch all ratings for these activities
      const { data: ratings, error: ratingsError } = await supabase
        .from('activity_ratings')
        .select(`
          activity_id,
          rating,
          rated_entity_id,
          rating_type
        `)
        .in('activity_id', activityIds);

      if (!ratingsError && ratings) {
        ratings.forEach(rating => {
          if (rating.rating_type === 'studio') {
            studioRatingsMap.set(rating.activity_id, rating.rating);
            console.log(`📊 Mapped studio rating for activity ${rating.activity_id}: ${rating.rating}`);
          } else if (rating.rating_type === 'class') {
            classRatingsMap.set(rating.activity_id, rating.rating);
            console.log(`📊 Mapped class rating for activity ${rating.activity_id}: ${rating.rating}`);
          } else if (rating.rating_type === 'instructor') {
            instructorRatingsMap.set(rating.activity_id, rating.rating);
            console.log(`📊 Mapped instructor rating for activity ${rating.activity_id}: ${rating.rating}`);
          }
        });
        console.log(`📊 Total ratings fetched: ${ratings.length}`, {
          studio: studioRatingsMap.size,
          class: classRatingsMap.size,
          instructor: instructorRatingsMap.size
        });
      } else if (ratingsError) {
        console.error('Error fetching ratings:', ratingsError);
      }
    }

    // Get actual like counts from activity_feed_likes table
    const { data: likeCounts } = await supabase
      .from('activity_feed_likes')
      .select('activity_id')
      .in('activity_id', activityIds);

    // Count likes per activity
    const actualLikeCounts = new Map();
    likeCounts?.forEach(like => {
      const currentCount = actualLikeCounts.get(like.activity_id) || 0;
      actualLikeCounts.set(like.activity_id, currentCount + 1);
    });

    console.log('📊 Actual like counts from database:', Array.from(actualLikeCounts.entries()));

    const transformedActivities = await Promise.all((activities as unknown as ActivityFeedItem[])?.map(async (activity) => {
      const formatted = await formatActivityMessage(activity, user.id);
      const extraData = activity.extra_data || {};
      
      // Debug logging for route data and metrics
      console.log('🔍 Backend - Activity extra data:', {
        id: activity.id,
        activity_type: (activity as any).activity_type,
        extraData: extraData,
        hasRouteData: 'route_data' in extraData,
        hasDistance: 'distance' in extraData,
        hasDuration: 'duration' in extraData,
        routeData: (extraData as any).route_data,
        distance: (extraData as any).distance,
        duration: (extraData as any).duration
      });
      
      // Debug logging for images
      if ((extraData as any).photos || (extraData as any).image_url) {
        console.log('📸 Feed API - Activity with images:', {
          id: activity.id,
          hasPhotos: !!(extraData as any).photos,
          photosCount: Array.isArray((extraData as any).photos) ? (extraData as any).photos.length : 0,
          hasImageUrl: !!(extraData as any).image_url,
          imageUrl: (extraData as any).image_url,
          photos: (extraData as any).photos
        });
      }
      
      const result = {
        id: activity.id,
        userId: activity.user_id, // Add user ID for navigation
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
        activity_type: 'activity_type' in extraData ? (extraData.activity_type as string) : activity.type,
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
        photos: 'photos' in extraData && Array.isArray(extraData.photos) ? extraData.photos.map((url: string) => ({ uri: url })) : [],
        routeData: 'route_data' in extraData ? extraData.route_data : undefined,
        distance: 'distance' in extraData ? extraData.distance : undefined,
        duration: 'duration' in extraData ? extraData.duration : undefined,
        studioRating: studioRatingsMap.get(activity.id) || null,
        classRating: classRatingsMap.get(activity.id) || null,
        instructorRating: instructorRatingsMap.get(activity.id) || null,
        howItWent: 'how_it_went' in extraData ? extraData.how_it_went || null : null
      };
      
      // Log all ratings for this activity
      const hasStudioRating = studioRatingsMap.has(activity.id);
      const hasClassRating = classRatingsMap.has(activity.id);
      const hasInstructorRating = instructorRatingsMap.has(activity.id);
      const activityType = 'activity_type' in extraData ? (extraData.activity_type as string) : activity.type;
      
      if (hasStudioRating || hasClassRating || hasInstructorRating) {
        console.log(`📊 Activity ${activity.id} (${activityType}) ratings:`, {
          studio: hasStudioRating ? studioRatingsMap.get(activity.id) : null,
          class: hasClassRating ? classRatingsMap.get(activity.id) : null,
          instructor: hasInstructorRating ? instructorRatingsMap.get(activity.id) : null,
        });
      }
      
      return result;
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

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 