import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { NotificationService } from '@/lib/notifications';

// Type definitions
interface UserData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface SupabaseCommentWithUser {
  id: string;
  content: string;
  created_at: string;
  users: UserData | null;
}

// GET /api/comments?activity_id=<id> - Fetch comments for an activity
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activityId = searchParams.get('activity_id');

    if (!activityId) {
      return NextResponse.json({ error: 'activity_id is required' }, { status: 400 });
    }

    // Get the user from auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch comments for the activity
    const { data: comments, error: commentsError } = await supabase
      .from('activity_comments')
      .select(`
        id,
        content,
        created_at,
        users (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
    }

    // Transform comments for frontend
    const transformedComments = comments?.map((comment: unknown) => {
      const c = comment as SupabaseCommentWithUser;
      return {
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user: {
          id: c.users?.id,
          username: c.users?.username,
          full_name: c.users?.full_name,
          avatar_url: c.users?.avatar_url,
        }
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: transformedComments
    });

  } catch (error) {
    console.error('Comments GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/comments - Create a new comment
export async function POST(request: NextRequest) {
  try {
    const { activity_id, content } = await request.json();

    if (!activity_id || !content?.trim()) {
      return NextResponse.json({ 
        error: 'activity_id and content are required' 
      }, { status: 400 });
    }

    // Get the user from auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create the comment
    const { data: comment, error: commentError } = await supabase
      .from('activity_comments')
      .insert({
        activity_id,
        user_id: user.id,
        content: content.trim()
      })
      .select(`
        id,
        content,
        created_at,
        users (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .single();

    if (commentError) {
      console.error('Error creating comment:', commentError);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    // Get the activity owner to send notification
    const { data: activityData, error: activityError } = await supabase
      .from('activity_feed')
      .select('user_id, comment_count')
      .eq('id', activity_id)
      .single();

    if (!activityError && activityData) {
      // Update comment_count
      const newCount = (activityData.comment_count || 0) + 1;
      
      const { error: updateError } = await supabase
        .from('activity_feed')
        .update({ comment_count: newCount })
        .eq('id', activity_id);

      if (updateError) {
        console.error('Error updating comment count:', updateError);
      }

      // Create notification for the post owner (if not commenting on own post)
      if (activityData.user_id !== user.id) {
        try {
          await NotificationService.createNotification('comment', {
            fromUserId: user.id,
            toUserId: activityData.user_id,
            relatedId: activity_id,
            extraData: {}
          });
        } catch (notificationError) {
          console.error('Error creating comment notification:', notificationError);
          // Don't fail the comment creation if notification fails
        }
      }
    }

    // Transform comment for frontend
    const c = comment as unknown as SupabaseCommentWithUser;
    const transformedComment = {
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      user: {
        id: c.users?.id,
        username: c.users?.username,
        full_name: c.users?.full_name,
        avatar_url: c.users?.avatar_url,
      }
    };

    return NextResponse.json({
      success: true,
      data: transformedComment
    });

  } catch (error) {
    console.error('Comments POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 