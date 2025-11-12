import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/reports - Create a new report
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { activityId, reason, description } = body;

    if (!activityId) {
      return NextResponse.json({ error: 'activityId is required' }, { status: 400 });
    }

    // Verify the activity exists
    const { data: activity, error: activityError } = await supabaseAdmin!
      .from('activity_feed')
      .select('id, user_id')
      .eq('id', activityId)
      .single();

    if (activityError || !activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    // Prevent users from reporting their own posts
    if (activity.user_id === user.id) {
      return NextResponse.json({ error: 'You cannot report your own post' }, { status: 400 });
    }

    // Check if user has already reported this activity
    const { data: existingReport } = await supabaseAdmin!
      .from('activity_reports')
      .select('id')
      .eq('activity_id', activityId)
      .eq('reporter_id', user.id)
      .single();

    if (existingReport) {
      return NextResponse.json({ 
        error: 'You have already reported this post',
        alreadyReported: true 
      }, { status: 400 });
    }

    // Create the report
    const { data: report, error: reportError } = await supabaseAdmin!
      .from('activity_reports')
      .insert({
        activity_id: activityId,
        reporter_id: user.id,
        reported_user_id: activity.user_id,
        reason: reason || null,
        description: description || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (reportError) {
      console.error('Error creating report:', reportError);
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: report,
      message: 'Report submitted successfully. We will review it and take appropriate action.'
    });

  } catch (error: any) {
    console.error('Error in POST /api/reports:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/reports - Get reports (admin only, for future use)
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
    // For now, return empty array
    return NextResponse.json({
      success: true,
      data: []
    });

  } catch (error: any) {
    console.error('Error in GET /api/reports:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

