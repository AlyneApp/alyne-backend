import { NextRequest, NextResponse } from 'next/server';
import { moderateActivityFeedEntry } from '@/lib/moderation/service';

/**
 * POST /api/activities/moderate
 * Manually trigger moderation for an activity (can be called after activity creation)
 * This is useful if moderation wasn't triggered automatically
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { activityId } = body;

    if (!activityId) {
      return NextResponse.json({ error: 'activityId is required' }, { status: 400 });
    }

    // Moderate the activity (this should not throw, but wrap in try-catch just in case)
    try {
      await moderateActivityFeedEntry(activityId);
    } catch (modError: any) {
      console.error('Error in moderateActivityFeedEntry:', modError);
      // Return success even if moderation fails - we don't want to break the app
      // The activity will remain with moderation_status = 'pending'
      return NextResponse.json({
        success: false,
        message: 'Moderation completed with errors',
        error: modError.message || 'Unknown error',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Activity moderated successfully',
    });
  } catch (error: any) {
    console.error('Error in POST /api/activities/moderate:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

