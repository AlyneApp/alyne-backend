import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { NotificationService, BaseNotification } from '@/lib/notifications';

// Frontend notification interface
interface FrontendNotification {
  id: string;
  type: string;
  message: string;
  time: string;
  isRead: boolean;
  fromUser: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  relatedId: string | null;
  extraData: Record<string, unknown>;
  followState?: {
    isFollowing: boolean;
    isPending: boolean;
  };
}

// Helper function to get relative time
function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} min ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
}

// Helper function to fetch user data
async function fetchUserData(userId: string) {
  const { data: userData, error } = await supabaseAdmin
    .from('users')
    .select('id, username, full_name, avatar_url')
    .eq('id', userId)
    .single();

  if (error || !userData) {
    return null;
  }

  return {
    id: userData.id,
    username: userData.username,
    fullName: userData.full_name,
    avatarUrl: userData.avatar_url
  };
}

// Transform backend notification to frontend format
async function transformNotification(notification: BaseNotification, currentUserId: string): Promise<FrontendNotification> {
  const timeAgo = getRelativeTime(notification.created_at);
  
  // Fetch user data if from_user_id exists
  let fromUser = null;
  if (notification.from_user_id) {
    fromUser = await fetchUserData(notification.from_user_id);
  }
  
  // Fetch follow state for follow notifications
  let followState = undefined;
  if (notification.type === 'follow' && fromUser) {
    const { data: friendship, error: friendshipError } = await supabaseAdmin
      .from('friends')
      .select('approved')
      .eq('user_id', currentUserId)
      .eq('friend_id', fromUser.id)
      .maybeSingle();
    
    if (friendshipError) {
      console.error('Error querying friendship:', friendshipError);
    }
    
    if (friendship) {
      followState = {
        isFollowing: friendship.approved,
        isPending: !friendship.approved
      };
    } else {
      followState = {
        isFollowing: false,
        isPending: false
      };
    }
    

  }
  
  return {
    id: notification.id,
    type: notification.type,
    message: notification.message,
    time: timeAgo,
    isRead: notification.is_read,
    fromUser,
    relatedId: notification.related_id,
    extraData: notification.extra_data,
    followState
  };
}

// GET /api/notifications - Get notifications or unread count
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const countOnly = searchParams.get('count');

    // If countOnly is true, just return the unread count
    if (countOnly === 'true') {
      const { count, error: countError } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('to_user_id', user.id)
        .eq('is_read', false);

      if (countError) {
        return NextResponse.json({ error: 'Failed to fetch unread count' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        unreadCount: count || 0
      });
    }

    // Otherwise, fetch all notifications
    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('to_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }

    const transformedNotifications = await Promise.all(
      notifications.map(notification => transformNotification(notification, user.id))
    );

    return NextResponse.json({
      success: true,
      data: transformedNotifications
    });

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/notifications - Create a notification
export async function POST(request: NextRequest) {
  try {
    // Get the user ID from the authorization header
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
    const { type, toUserId, relatedId, extraData, message } = body;

    if (!type || !toUserId) {
      return NextResponse.json({ error: 'type and toUserId are required' }, { status: 400 });
    }

    // Create notification using the service
    await NotificationService.createNotification(type, {
      fromUserId: user.id,
      toUserId,
      relatedId,
      extraData,
      message
    });

    return NextResponse.json({
      success: true,
      message: 'Notification created successfully'
    });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/notifications - Mark notification as read
export async function PATCH(request: NextRequest) {
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
    const { mark_all_unread } = body;

    // Mark all unread notifications as read in one query
    if (mark_all_unread) {
      const { error: updateError } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('to_user_id', user.id)
        .eq('is_read', false);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/notifications - Delete a notification
export async function DELETE(request: NextRequest) {
  try {
    // Get the user ID from the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');

    if (!notificationId) {
      return NextResponse.json({ error: 'notification id is required' }, { status: 400 });
    }

    // Delete notification using the service
    await NotificationService.deleteNotification(notificationId);

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 