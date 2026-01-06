import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { NotificationService } from '@/lib/notifications';

// POST /api/likes - Toggle like (Instagram-style)
export async function POST(request: NextRequest) {
  try {
    const { activity_id } = await request.json();

    if (!activity_id) {
      return NextResponse.json({ error: 'activity_id is required' }, { status: 400 });
    }

    // Get user from auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if already liked
    const { data: existingLikes } = await supabase
      .from('activity_feed_likes')
      .select('id')
      .eq('activity_id', activity_id)
      .eq('user_id', user.id);

    const existingLike = existingLikes && existingLikes.length > 0;

    if (existingLike) {
      // Unlike
      await supabase
        .from('activity_feed_likes')
        .delete()
        .eq('activity_id', activity_id)
        .eq('user_id', user.id);

      const { data: currentActivity, error: activityError } = await supabaseAdmin!
        .from('activity_feed')
        .select('like_count')
        .eq('id', activity_id)
        .single();

      if (!activityError && currentActivity) {
        const newCount = Math.max(0, (currentActivity.like_count || 0) - 1);

        const { error: updateError } = await supabaseAdmin!
          .from('activity_feed')
          .update({ like_count: newCount })
          .eq('id', activity_id);

        if (updateError) {
          console.error('Error updating like count:', updateError);
        }
      }

      return NextResponse.json({ success: true, liked: false });
    } else {
      // Like
      await supabase
        .from('activity_feed_likes')
        .insert({ activity_id, user_id: user.id });

      // Get activity owner and update like_count
      const { data: currentActivity, error: activityError } = await supabaseAdmin!
        .from('activity_feed')
        .select('user_id, like_count')
        .eq('id', activity_id)
        .single();

      if (!activityError && currentActivity) {
        const newCount = (currentActivity.like_count || 0) + 1;

        const { error: updateError } = await supabaseAdmin!
          .from('activity_feed')
          .update({ like_count: newCount })
          .eq('id', activity_id);

        if (updateError) {
          console.error('Error updating like count:', updateError);
        }

        // Create notification for the post owner (if not liking own post)
        if (currentActivity.user_id !== user.id) {
          try {
            await NotificationService.createNotification('like', {
              fromUserId: user.id,
              toUserId: currentActivity.user_id,
              relatedId: activity_id,
              extraData: {}
            });
          } catch (notificationError) {
            console.error('Error creating like notification:', notificationError);
            // Don't fail the like creation if notification fails
          }
        }
      }

      return NextResponse.json({ success: true, liked: true });
    }
  } catch (error) {
    console.error('Like toggle error:', error);
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 });
  }
}

// GET /api/likes?activity_ids=id1,id2,id3 - Get user's like status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activityIdsParam = searchParams.get('activity_ids');

    if (!activityIdsParam) {
      return NextResponse.json({ success: true, likes: {} });
    }

    // Limit to reasonable number to avoid slow queries
    const activityIds = activityIdsParam.split(',').slice(0, 20);

    if (activityIds.length === 0) {
      return NextResponse.json({ success: true, likes: {} });
    }

    // Get user from auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's likes
    const { data: userLikes } = await supabase
      .from('activity_feed_likes')
      .select('activity_id')
      .eq('user_id', user.id)
      .in('activity_id', activityIds);

    // Convert to simple format
    const likesMap = activityIds.reduce((acc: Record<string, boolean>, id: string) => {
      acc[id] = userLikes?.some((like: { activity_id: string }) => like.activity_id === id) || false;
      return acc;
    }, {});

    return NextResponse.json({ success: true, likes: likesMap });
  } catch (error) {
    console.error('Get likes error:', error);
    return NextResponse.json({ error: 'Failed to get like status' }, { status: 500 });
  }
} 