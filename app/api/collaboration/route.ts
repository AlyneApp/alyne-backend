import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// POST /api/collaboration - Create collaboration requests for tagged members
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { activity_id, tagged_members } = body;

    if (!activity_id || !tagged_members || !Array.isArray(tagged_members)) {
      return NextResponse.json({ error: 'activity_id and tagged_members array are required' }, { status: 400 });
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
    // Verify the activity belongs to the current user
    const { data: activity, error: activityError } = await supabase
      .from('activity_feed')
      .select('id, user_id')
      .eq('id', activity_id)
      .single();

    if (activityError || !activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    if (activity.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized to create collaboration requests for this activity' }, { status: 403 });
    }

    // Get user profile for notification message
    const { data: userProfile } = await supabase
      .from('users')
      .select('username, full_name')
      .eq('id', user.id)
      .single();

    const userName = userProfile?.full_name || userProfile?.username || 'Someone';

    // Create notifications for each tagged member
    let createdNotifications = 0;

    for (const memberId of tagged_members) {
      // Skip if trying to tag yourself
      if (memberId === user.id) continue;

      // Check if collaboration notification already exists
      const { data: existingNotification } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('related_id', activity_id)
        .eq('to_user_id', memberId)
        .eq('type', 'collaboration_request')
        .single();

      if (existingNotification) continue; // Skip if notification already exists

      // Create notification for the tagged member
      const { error: notificationError } = await supabaseAdmin
        .from('notifications')
        .insert({
          type: 'collaboration_request',
          message: `${userName} tagged you in a workout`,
          from_user_id: user.id,
          to_user_id: memberId,
          related_id: activity_id, // Use activity_id directly
          is_read: false
        });

      if (notificationError) {
        console.error('Error creating collaboration notification:', notificationError);
        continue; // Skip this member but continue with others
      }

      createdNotifications++;
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdNotifications} collaboration requests`,
      data: {
        created_requests: createdNotifications
      }
    });

  } catch (error) {
    console.error('Collaboration API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

 