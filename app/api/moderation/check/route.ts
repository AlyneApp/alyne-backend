import { NextRequest, NextResponse } from 'next/server';
import { moderateActivity } from '@/lib/moderation';

/**
 * POST /api/moderation/check
 * Check content before it's posted
 * This can be called from the frontend before creating an activity
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      activity_name,
      class_name,
      how_it_went,
      instructor_name,
      studio_name,
    } = body;

    // Moderate text content (image moderation removed)
    const moderationResult = await moderateActivity({
      activity_name,
      class_name,
      how_it_went,
      instructor_name,
      studio_name,
    });

    return NextResponse.json({
      success: true,
      data: moderationResult,
    });
  } catch (error: any) {
    console.error('Error in moderation check:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to moderate content',
      },
      { status: 500 }
    );
  }
}

