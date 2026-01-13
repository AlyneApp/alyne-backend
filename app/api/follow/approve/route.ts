import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// POST /api/follow/approve - Approve or deny a follow request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { follow_request_id, action } = body;

    if (!follow_request_id || !action) {
      return NextResponse.json({ error: 'follow_request_id and action are required' }, { status: 400 });
    }

    if (!['approve', 'deny'].includes(action)) {
      return NextResponse.json({ error: 'action must be either "approve" or "deny"' }, { status: 400 });
    }

    // Get the user ID from the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }
    // Validate supabaseAdmin
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error: supabaseAdmin not available' },
        { status: 500 }
      );
    }
    // Get the follow request to verify ownership
    const { data: followRequest, error: fetchError } = await supabase
      .from('friends')
      .select('id, user_id, friend_id, approved')
      .eq('id', follow_request_id)
      .eq('friend_id', user.id) // The current user should be the one being followed
      .eq('approved', false) // Should be a pending request
      .single();

    if (fetchError || !followRequest) {
      return NextResponse.json({ error: 'Follow request not found or unauthorized' }, { status: 404 });
    }

    if (action === 'approve') {
      // Approve the follow request
      const { error: updateError } = await supabase
        .from('friends')
        .update({ approved: true })
        .eq('id', follow_request_id);

      if (updateError) {
        console.error('Error approving follow request:', updateError);
        return NextResponse.json({ error: 'Failed to approve follow request' }, { status: 500 });
      }

      // Get the follower's profile for the notification message
      const { data: followerProfile } = await supabase
        .from('users')
        .select('username, full_name')
        .eq('id', followRequest.user_id)
        .single();

      const followerName = followerProfile?.full_name || followerProfile?.username || 'Someone';

      // Update the original follow request notification to show "X is now following you. Follow back?"
      const { error: updateNotificationError } = await supabase
        .from('notifications')
        .update({
          type: 'follow_request',
          message: `${followerName} is now following you. Follow back?`,
          is_read: false
        })
        .eq('related_id', follow_request_id)
        .eq('type', 'follow_request');

      if (updateNotificationError) {
        console.error('Error updating notification:', updateNotificationError);
      }

      // Create a notification for the follower
      const { error: notificationError } = await supabaseAdmin
        .from('notifications')
        .insert({
          type: 'follow_approved',
          message: `Your follow request was approved!`,
          from_user_id: user.id,
          to_user_id: followRequest.user_id,
          related_id: followRequest.id,
          is_read: false
        });

      if (notificationError) {
        console.error('Error creating approval notification:', notificationError);
        // Don't fail the request if notification creation fails
      }

      return NextResponse.json({
        success: true,
        message: 'Follow request approved'
      });

    } else {
      // Deny the follow request by deleting both the friendship and notification
      const { error: deleteError } = await supabase
        .from('friends')
        .delete()
        .eq('id', follow_request_id);

      if (deleteError) {
        console.error('Error denying follow request:', deleteError);
        return NextResponse.json({ error: 'Failed to deny follow request' }, { status: 500 });
      }

      // Delete the notification
      const { error: deleteNotificationError } = await supabase
        .from('notifications')
        .delete()
        .eq('related_id', follow_request_id)
        .eq('type', 'follow_request')
        .eq('to_user_id', user.id);

      if (deleteNotificationError) {
        console.error('Error deleting notification:', deleteNotificationError);
        // Don't fail the request if notification deletion fails
      }

      return NextResponse.json({
        success: true,
        message: 'Follow request denied'
      });
    }

  } catch (error) {
    console.error('Follow approve API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 