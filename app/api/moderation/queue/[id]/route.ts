import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * PATCH /api/moderation/queue/[id]
 * Update moderation queue item (approve/reject/dismiss)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin!.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    // TODO: Add admin check here

    const { id } = await params;
    const body = await request.json();
    const { action, status } = body; // action: 'approve' | 'reject' | 'dismiss'

    if (!action || !['approve', 'reject', 'dismiss'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get the queue item
    const { data: queueItem, error: fetchError } = await supabaseAdmin!
      .from('content_moderation_queue')
      .select('activity_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !queueItem) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    // Determine new status
    let newStatus: string;
    let activityModerationStatus: string;

    if (action === 'approve') {
      newStatus = 'resolved';
      activityModerationStatus = 'approved';
    } else if (action === 'reject') {
      newStatus = 'resolved';
      activityModerationStatus = 'rejected';
    } else {
      newStatus = 'dismissed';
      activityModerationStatus = 'approved'; // Dismiss = approve
    }

    // Update queue item
    const { error: updateError } = await supabaseAdmin!
      .from('content_moderation_queue')
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating queue item:', updateError);
      return NextResponse.json({ error: 'Failed to update queue item' }, { status: 500 });
    }

    // Update activity feed moderation status
    const { error: activityUpdateError } = await supabaseAdmin!
      .from('activity_feed')
      .update({
        moderation_status: activityModerationStatus,
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', queueItem.activity_id);

    if (activityUpdateError) {
      console.error('Error updating activity moderation status:', activityUpdateError);
      // Don't fail the whole request if this fails
    }

    // If rejected, optionally delete the activity
    if (action === 'reject') {
      // You might want to delete the activity or just hide it
      // For now, we'll just mark it as rejected
      // Uncomment to delete:
      // await supabaseAdmin!.from('activity_feed').delete().eq('id', queueItem.activity_id);
    }

    return NextResponse.json({
      success: true,
      message: `Content ${action}d successfully`,
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/moderation/queue/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

