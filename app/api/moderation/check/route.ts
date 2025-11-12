import { NextRequest, NextResponse } from 'next/server';
import { moderateActivity, moderateImageUrl } from '@/lib/moderation';

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
      imageUrls, // URLs of images to moderate
    } = body;

    // Moderate text content
    const moderationResult = await moderateActivity({
      activity_name,
      class_name,
      how_it_went,
      instructor_name,
      studio_name,
      imageUrls,
    });

    // If images are provided as URLs, moderate them
    if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
      const imageResults = await Promise.all(
        imageUrls.map((url: string) => moderateImageUrl(url))
      );

      const flaggedImages = imageResults.filter((img) => img.flagged);
      if (flaggedImages.length > 0) {
        moderationResult.flagged = true;
        moderationResult.moderationScore = Math.max(
          moderationResult.moderationScore,
          0.8
        );
        moderationResult.reasons.push(
          `NSFW image detected (${flaggedImages.length} image(s))`
        );
        moderationResult.details.imageModeration = imageResults;
      }
    }

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

