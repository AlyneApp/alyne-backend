import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// DELETE /api/activity/[id] - Delete an activity feed post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params;

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

    // First, verify the activity belongs to the user
    const { data: activity, error: fetchError } = await supabaseAdmin
      .from('activity_feed')
      .select('user_id, id')
      .eq('id', activityId)
      .single();

    if (fetchError || !activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    if (activity.user_id !== user.id) {
      return NextResponse.json({ error: 'You can only delete your own posts' }, { status: 403 });
    }

    // Delete all related data first
    // Delete likes
    await supabaseAdmin
      .from('activity_feed_likes')
      .delete()
      .eq('activity_id', activityId);

    // Delete comments
    await supabaseAdmin
      .from('activity_comments')
      .delete()
      .eq('activity_id', activityId);

    // Delete photos if any
    await supabaseAdmin
      .from('activity_feed_photos')
      .delete()
      .eq('activity_id', activityId);

    // Finally, delete the activity itself
    const { error: deleteError } = await supabaseAdmin
      .from('activity_feed')
      .delete()
      .eq('id', activityId);

    if (deleteError) {
      console.error('Error deleting activity:', deleteError);
      return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Activity deleted successfully'
    });

  } catch (error) {
    console.error('Error in DELETE /api/activity/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
// PATCH /api/activity/[id] - Update an activity feed post
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: activityId } = await params;
    const body = await request.json();
    const { extra_data, collaboration_partners, ratings } = body;

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

    // First, verify the activity belongs to the user
    const { data: activity, error: fetchError } = await supabaseAdmin
      .from('activity_feed')
      .select('user_id, id')
      .eq('id', activityId)
      .single();

    if (fetchError || !activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    if (activity.user_id !== user.id) {
      return NextResponse.json({ error: 'You can only edit your own posts' }, { status: 403 });
    }

    // Update activity feed
    const { error: updateError } = await supabaseAdmin
      .from('activity_feed')
      .update({
        extra_data,
        collaboration_partners,
        updated_at: new Date().toISOString()
      })
      .eq('id', activityId);

    if (updateError) {
      console.error('Error updating activity:', updateError);
      return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 });
    }

    // Update ratings if provided
    if (ratings && Array.isArray(ratings)) {
      // For simplicity, we'll delete existing ratings for this activity and insert new ones
      // This matches the logic in the original create-activity flow where ratings are separate records
      await supabaseAdmin
        .from('activity_ratings')
        .delete()
        .eq('activity_id', activityId)
        .eq('user_id', user.id);

      if (ratings.length > 0) {
        const { error: ratingsError } = await supabaseAdmin
          .from('activity_ratings')
          .insert(ratings.map(r => ({
            ...r,
            activity_id: activityId,
            user_id: user.id
          })));

        if (ratingsError) {
          console.error('Error updating ratings:', ratingsError);
          // We don't fail the whole update if ratings fail, but we log it
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Activity updated successfully'
    });

  } catch (error) {
    console.error('Error in PATCH /api/activity/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
