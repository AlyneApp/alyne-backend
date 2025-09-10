import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { NotificationService } from '@/lib/notifications';

// POST /api/notifications/action - Handle notification actions (accept/decline)
export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

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
    const { notificationId, action, transferId, transferrerId } = body;

    if (!notificationId || !action) {
      return NextResponse.json({ error: 'notificationId and action are required' }, { status: 400 });
    }

    // Get the notification to verify ownership and type
    const { data: notification, error: notificationError } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('to_user_id', user.id)
      .single();

    if (notificationError || !notification) {
      return NextResponse.json({ error: 'Notification not found or access denied' }, { status: 404 });
    }

    // Check if notification is still pending
    if (notification.status !== 'pending') {
      return NextResponse.json({ 
        error: 'Notification action has already been processed',
        status: notification.status 
      }, { status: 400 });
    }

    let newStatus: 'accepted' | 'declined' | 'completed';
    let updatedMessage = notification.message;

    // Handle different notification types and actions
    switch (notification.type) {
      case 'payment_confirmation':
        if (action === 'approve') {
          if (!transferId) {
            return NextResponse.json({ error: 'transferId is required for payment confirmation' }, { status: 400 });
          }
          
          // For payment confirmation, the transferrer is the user who received the notification
          const finalTransferrerId = transferrerId || notification.to_user_id;

          // Call the confirm-payment API
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'}/api/transfers/confirm-payment`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              transferId,
              transferrerId: finalTransferrerId,
              notificationId: notificationId,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              newStatus = 'accepted';
              updatedMessage = `Payment confirmed for ${notification.extra_data?.class_name} at ${notification.extra_data?.studio_name}`;
            } else {
              console.error('Confirm payment failed:', data);
              return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 });
            }
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Confirm payment response not ok:', response.status, errorData);
            return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 });
          }
        } else {
          newStatus = 'declined';
          updatedMessage = `Payment request declined for ${notification.extra_data?.class_name} at ${notification.extra_data?.studio_name}`;
        }
        break;

      case 'follow_request':
        if (action === 'approve') {
          // Handle follow request approval
          const { error: followError } = await supabaseAdmin
            .from('friends')
            .update({ approved: true })
            .eq('user_id', user.id)
            .eq('friend_id', notification.from_user_id);

          if (followError) {
            return NextResponse.json({ error: 'Failed to approve follow request' }, { status: 500 });
          }

          newStatus = 'completed';
          updatedMessage = `${notification.extra_data?.from_user_name || 'User'} is now following you. Follow back?`;
        } else {
          // Handle follow request denial
          const { error: deleteError } = await supabaseAdmin
            .from('friends')
            .delete()
            .eq('user_id', user.id)
            .eq('friend_id', notification.from_user_id);

          if (deleteError) {
            return NextResponse.json({ error: 'Failed to decline follow request' }, { status: 500 });
          }

          newStatus = 'declined';
          updatedMessage = `Follow request from ${notification.extra_data?.from_user_name || 'User'} was declined`;
        }
        break;

      case 'collaboration_request':
        if (action === 'approve') {
          // Handle collaboration request approval
          const { error: collaborationError } = await supabaseAdmin
            .from('collaborations')
            .update({ status: 'approved' })
            .eq('id', notification.related_id);

          if (collaborationError) {
            return NextResponse.json({ error: 'Failed to approve collaboration request' }, { status: 500 });
          }

          newStatus = 'completed';
          updatedMessage = `You're collaborating on a workout post with ${notification.extra_data?.from_user_name || 'User'}`;
        } else {
          // Handle collaboration request denial
          const { error: collaborationError } = await supabaseAdmin
            .from('collaborations')
            .update({ status: 'declined' })
            .eq('id', notification.related_id);

          if (collaborationError) {
            return NextResponse.json({ error: 'Failed to decline collaboration request' }, { status: 500 });
          }

          newStatus = 'declined';
          updatedMessage = `Collaboration request from ${notification.extra_data?.from_user_name || 'User'} was declined`;
        }
        break;

      default:
        return NextResponse.json({ error: `Unsupported notification type: ${notification.type}` }, { status: 400 });
    }

    // Update the notification status
    try {
      await NotificationService.updateNotificationStatus(notificationId, newStatus, updatedMessage);
    } catch (error) {
      console.error('Error updating notification status:', error);
      return NextResponse.json({ error: 'Failed to update notification status' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Notification action processed successfully',
      status: newStatus,
      updatedMessage
    });

  } catch (error) {
    console.error('Error handling notification action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
