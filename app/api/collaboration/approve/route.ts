import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collaboration_request_id, action } = body;

    if (!collaboration_request_id || !action) {
      return NextResponse.json({ error: 'collaboration_request_id and action are required' }, { status: 400 });
    }

    if (!['approve', 'deny'].includes(action)) {
      return NextResponse.json({ error: 'action must be either "approve" or "deny"' }, { status: 400 });
    }

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
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('id, related_id, from_user_id, to_user_id, type')
      .eq('id', collaboration_request_id)
      .eq('to_user_id', user.id)
      .eq('type', 'collaboration_request')
      .single();

    if (fetchError || !notification) {
      return NextResponse.json({ error: 'Collaboration request not found or unauthorized' }, { status: 404 });
    }

    if (action === 'approve') {
      const { data: originalActivity } = await supabase
        .from('activity_feed')
        .select('*')
        .eq('id', notification.related_id)
        .single();

      if (originalActivity) {
        const { error: createError } = await supabase
          .from('activity_feed')
          .insert({
            user_id: user.id,
            type: originalActivity.type,
            studio_id: originalActivity.studio_id,
            extra_data: originalActivity.extra_data,
            collaboration_partners: [
              originalActivity.user_id,
              ...(originalActivity.collaboration_partners || [])
            ].filter(partnerId => partnerId !== user.id)
          })
          .select()
          .single();

        if (createError) {
          return NextResponse.json({ error: 'Failed to create collaboration activity' }, { status: 500 });
        }

        const currentPartners = originalActivity.collaboration_partners || [];
        const updatedPartners = [...currentPartners, user.id];

        const { error: activityUpdateError } = await supabase
          .from('activity_feed')
          .update({ collaboration_partners: updatedPartners })
          .eq('id', notification.related_id);

        if (activityUpdateError) {
          console.error('Error updating original activity collaboration partners:', activityUpdateError);
        }
      } else {
        return NextResponse.json({ error: 'Original activity not found' }, { status: 404 });
      }

      const { data: activityOwnerProfile } = await supabase
        .from('users')
        .select('username, full_name')
        .eq('id', notification.from_user_id)
        .single();

      const activityOwnerName = activityOwnerProfile?.full_name || activityOwnerProfile?.username || 'Someone';

      const { error: updateNotificationError } = await supabase
        .from('notifications')
        .update({
          type: 'collaboration_approved',
          message: `You're collaborating on a workout post with ${activityOwnerName}.`,
          is_read: false
        })
        .eq('id', collaboration_request_id);

      if (updateNotificationError) {
        console.error('Error updating notification:', updateNotificationError);
      }

      const { data: approverProfile } = await supabase
        .from('users')
        .select('username, full_name')
        .eq('id', user.id)
        .single();

      const approverName = approverProfile?.full_name || approverProfile?.username || 'Someone';

      const { error: notificationError } = await supabaseAdmin
        .from('notifications')
        .insert({
          type: 'collaboration_approved',
          message: `${approverName} accepted your collaboration request.`,
          from_user_id: user.id,
          to_user_id: notification.from_user_id,
          related_id: notification.related_id,
          is_read: false
        });

      if (notificationError) {
        console.error('Error creating approval notification:', notificationError);
      }

      return NextResponse.json({
        success: true,
        message: 'Collaboration request approved'
      });

    } else {
      const { error: deleteNotificationError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', collaboration_request_id)
        .eq('to_user_id', user.id);

      if (deleteNotificationError) {
        console.error('Error deleting notification:', deleteNotificationError);
      }

      return NextResponse.json({
        success: true,
        message: 'Collaboration request denied'
      });
    }

  } catch (error) {
    console.error('Collaboration approve API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 