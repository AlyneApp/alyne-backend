import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Type definitions
interface UserData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface CommentData {
  id: string;
  content: string;
  created_at: string;
  users: UserData[];
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

    // Debug: Log the raw comment structure
    console.log('🔍 Raw comment structure from Supabase:', JSON.stringify(comments?.[0], null, 2));

    // Transform comments for frontend
    const transformedComments = comments?.map((comment: CommentData) => ({
      id: comment.id,
      content: comment.content,
      created_at: comment.created_at,
      user: {
        id: comment.users?.[0]?.id,
        username: comment.users?.[0]?.username,
        full_name: comment.users?.[0]?.full_name,
        avatar_url: comment.users?.[0]?.avatar_url,
      }
    })) || [];

    console.log(`💬 Comments API: Returning ${transformedComments.length} comments for activity ${activityId}`);
    if (transformedComments.length > 0) {
      console.log(`💬 Sample comment:`, transformedComments[0]);
    }

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

    // Transform comment for frontend
    const transformedComment = {
      id: comment.id,
      content: comment.content,
      created_at: comment.created_at,
      user: {
        id: (comment as CommentData).users?.[0]?.id,
        username: (comment as CommentData).users?.[0]?.username,
        full_name: (comment as CommentData).users?.[0]?.full_name,
        avatar_url: (comment as CommentData).users?.[0]?.avatar_url,
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