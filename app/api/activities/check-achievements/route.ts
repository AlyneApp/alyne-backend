import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { NotificationService } from '@/lib/notifications';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Milestone thresholds for studio visits
const MILESTONE_THRESHOLDS = [5, 10, 25, 50, 100, 250, 500];

// Streak thresholds to notify (notify every day, but can adjust)
const STREAK_THRESHOLDS = [3, 7, 14, 21, 30, 60, 90, 180, 365];

interface ActivityWithStudio {
  id: string;
  user_id: string;
  studio_id: string | null;
  created_at: string;
  extra_data: {
    activity_type?: string;
    activity_name?: string;
    studio_name?: string;
  };
  studios?: {
    name: string;
  };
}

// POST /api/activities/check-achievements
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const body = await request.json();
    const { activityId } = body;

    if (!activityId) {
      return NextResponse.json({ error: 'activityId is required' }, { status: 400 });
    }

    // Get the activity that was just created
    const { data: activity, error: activityError } = await supabaseAdmin
      .from('activity_feed')
      .select(`
        id,
        user_id,
        studio_id,
        created_at,
        extra_data,
        studios (
          name
        )
      `)
      .eq('id', activityId)
      .single() as { data: ActivityWithStudio | null; error: any };

    if (activityError || !activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    // Verify the activity belongs to the authenticated user
    if (activity.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const achievements: { type: string; data: any }[] = [];

    // Check for milestone achievements (studio visits)
    if (activity.studio_id) {
      const milestoneResult = await checkMilestone(user.id, activity.studio_id, activity);
      if (milestoneResult) {
        achievements.push({ type: 'milestone', data: milestoneResult });
      }
    }

    // Check for streak achievements
    const streakResult = await checkStreak(user.id, activity);
    if (streakResult) {
      achievements.push({ type: 'streak', data: streakResult });
    }

    return NextResponse.json({
      success: true,
      achievements
    });

  } catch (error) {
    console.error('Error in check-achievements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function checkMilestone(
  userId: string,
  studioId: string,
  activity: ActivityWithStudio
): Promise<{ count: number; studioName: string } | null> {
  // Count all activities at this studio for this user
  const { count, error } = await supabaseAdmin
    .from('activity_feed')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('studio_id', studioId)
    .eq('type', 'class_checkin');

  if (error || count === null) {
    console.error('Error counting studio visits:', error);
    return null;
  }

  const studioName = activity.studios?.name || activity.extra_data?.studio_name || 'this studio';

  // Check if this count matches a milestone threshold
  if (MILESTONE_THRESHOLDS.includes(count)) {
    // Check if we already sent a notification for this milestone
    const { data: existingNotification } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('to_user_id', userId)
      .eq('type', 'milestone')
      .eq('related_id', studioId)
      .contains('extra_data', { count, studioId })
      .single();

    if (existingNotification) {
      // Already notified for this milestone
      return null;
    }

    // Create milestone notification
    await NotificationService.createNotification('milestone', {
      toUserId: userId,
      extraData: {
        count,
        studioId,
        studioName
      }
    });

    return { count, studioName };
  }

  return null;
}

async function checkStreak(
  userId: string,
  activity: ActivityWithStudio
): Promise<{ count: number; activityName: string } | null> {
  // Get the user's activity dates for the last year, ordered by date
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data: activities, error } = await supabaseAdmin
    .from('activity_feed')
    .select('created_at, extra_data')
    .eq('user_id', userId)
    .eq('type', 'class_checkin')
    .gte('created_at', oneYearAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error || !activities || activities.length === 0) {
    return null;
  }

  // Get unique dates (in user's local timezone - using UTC for simplicity)
  const uniqueDates = new Set<string>();
  activities.forEach((act: { created_at: string }) => {
    const date = new Date(act.created_at).toISOString().split('T')[0];
    uniqueDates.add(date);
  });

  const sortedDates = Array.from(uniqueDates).sort().reverse();

  // Calculate current streak
  let streakCount = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Check if the most recent activity is today or yesterday
  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    // Streak broken
    return null;
  }

  // Count consecutive days
  let currentDate = new Date(sortedDates[0]);
  for (const dateStr of sortedDates) {
    const activityDate = new Date(dateStr);
    const expectedDate = currentDate.toISOString().split('T')[0];

    if (dateStr === expectedDate) {
      streakCount++;
      currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
    } else {
      // Gap in dates, streak ends
      break;
    }
  }

  if (streakCount < 2) {
    return null;
  }

  // Determine activity name from the most common activity type
  const activityName = activity.extra_data?.activity_name ||
                       activity.extra_data?.activity_type ||
                       'activities';

  // Check if this is a notable streak threshold
  const isNotableStreak = STREAK_THRESHOLDS.includes(streakCount);

  if (isNotableStreak) {
    // Check if we already sent a notification for this streak count
    const { data: existingNotification } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('to_user_id', userId)
      .eq('type', 'streak')
      .contains('extra_data', { count: streakCount })
      .single();

    if (existingNotification) {
      // Already notified for this streak
      return null;
    }

    // Create streak notification
    await NotificationService.createNotification('streak', {
      toUserId: userId,
      extraData: {
        count: streakCount,
        activityName
      }
    });

    return { count: streakCount, activityName };
  }

  return null;
}
