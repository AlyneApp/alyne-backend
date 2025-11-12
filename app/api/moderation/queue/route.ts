import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/moderation/queue
 * Get items in the moderation queue (admin only)
 */
export async function GET(request: NextRequest) {
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
    // For now, allow any authenticated user (you should restrict this to admins)

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get moderation queue items
    const { data: queueItems, error: queueError } = await supabaseAdmin!
      .from('content_moderation_queue')
      .select(`
        id,
        activity_id,
        flagged_reason,
        moderation_score,
        moderation_details,
        status,
        reviewed_by,
        reviewed_at,
        created_at,
        activity:activity_id (
          id,
          user_id,
          type,
          extra_data,
          created_at,
          users!activity_feed_user_id_fkey (
            id,
            username,
            full_name,
            avatar_url
          )
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (queueError) {
      console.error('Error fetching moderation queue:', queueError);
      return NextResponse.json({ error: 'Failed to fetch moderation queue' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: queueItems || [],
    });
  } catch (error: any) {
    console.error('Error in GET /api/moderation/queue:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/moderation/queue
 * Add an item to the moderation queue
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      activity_id,
      flagged_reason,
      moderation_score,
      moderation_details,
    } = body;

    if (!activity_id) {
      return NextResponse.json({ error: 'activity_id is required' }, { status: 400 });
    }

    // Check if already in queue
    const { data: existing } = await supabaseAdmin!
      .from('content_moderation_queue')
      .select('id')
      .eq('activity_id', activity_id)
      .eq('status', 'pending')
      .single();

    if (existing) {
      // Update existing queue item
      const { error: updateError } = await supabaseAdmin!
        .from('content_moderation_queue')
        .update({
          flagged_reason,
          moderation_score,
          moderation_details,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        data: { id: existing.id, updated: true },
      });
    }

    // Create new queue item
    const { data: queueItem, error: insertError } = await supabaseAdmin!
      .from('content_moderation_queue')
      .insert({
        activity_id,
        flagged_reason,
        moderation_score: moderation_score || 0,
        moderation_details: moderation_details || {},
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating moderation queue item:', insertError);
      return NextResponse.json({ error: 'Failed to add to moderation queue' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: queueItem,
    });
  } catch (error: any) {
    console.error('Error in POST /api/moderation/queue:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

