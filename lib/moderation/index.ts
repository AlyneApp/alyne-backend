// Main moderation service - combines all moderation methods
import { checkActivityContent } from './keywords';
import { moderateText } from './text';
import { moderateImage, moderateImages } from './image';

export interface ModerationResult {
  flagged: boolean;
  approved: boolean;
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'needs_review';
  moderationScore: number; // 0-1, higher = more likely to be objectionable
  reasons: string[];
  details: {
    keywordCheck?: {
      flagged: boolean;
      matchedKeywords: string[];
      flaggedFields: string[];
    };
    textModeration?: {
      flagged: boolean;
      scores?: Record<string, number>;
      categories?: string[];
    };
    imageModeration?: Array<{
      flagged: boolean;
      isNSFW: boolean;
      scores: any;
      reason?: string;
    }>;
  };
}

/**
 * Moderate activity content (text + images)
 */
export async function moderateActivity(data: {
  // Text content
  activity_name?: string;
  class_name?: string;
  how_it_went?: string;
  instructor_name?: string;
  studio_name?: string;
  // Images (as buffers or URLs)
  images?: Buffer[];
  imageUrls?: string[];
}): Promise<ModerationResult> {
  const reasons: string[] = [];
  let moderationScore = 0;
  const details: ModerationResult['details'] = {};

  // 1. Keyword filtering (instant, free)
  const keywordResult = checkActivityContent({
    activity_name: data.activity_name,
    class_name: data.class_name,
    how_it_went: data.how_it_went,
    instructor_name: data.instructor_name,
    studio_name: data.studio_name,
  });

  details.keywordCheck = keywordResult;

  if (keywordResult.flagged) {
    reasons.push(`Keyword violation in: ${keywordResult.flaggedFields.join(', ')}`);
    moderationScore += 0.6; // High weight for keyword violations
  }

  // 2. Text moderation (Hugging Face or simple)
  const allText = [
    data.activity_name,
    data.class_name,
    data.how_it_went,
    data.instructor_name,
    data.studio_name,
  ]
    .filter(Boolean)
    .join(' ');

  if (allText) {
    try {
      const textResult = await moderateText(allText, true); // Use Hugging Face if available
      details.textModeration = textResult;

      if (textResult.flagged) {
        reasons.push(`Text moderation: ${textResult.categories?.join(', ') || textResult.reason || 'flagged'}`);
        moderationScore += 0.4;
      }
    } catch (error) {
      console.error('Text moderation error:', error);
      // Continue with keyword check even if text moderation fails
    }
  }

  // 3. Image moderation (NSFW.js) - only if images are provided as buffers
  if (data.images && data.images.length > 0) {
    try {
      const imageResults = await moderateImages(data.images);
      details.imageModeration = imageResults;

      const flaggedImages = imageResults.filter((img) => img.flagged);
      if (flaggedImages.length > 0) {
        reasons.push(`NSFW image detected (${flaggedImages.length} image(s))`);
        moderationScore += 0.8; // Very high weight for NSFW images
      }
    } catch (error) {
      console.error('Image moderation error (non-blocking):', error);
      // Don't block if image moderation fails - keyword and text checks are more important
    }
  }

  // 4. Image URL moderation (if imageUrls provided instead of buffers)
  if (data.imageUrls && data.imageUrls.length > 0) {
    try {
      // Import moderateImageUrl from this file (it's defined below)
      const imageResults = await Promise.all(
        data.imageUrls.map((url) => moderateImageUrl(url))
      );
      details.imageModeration = imageResults;

      const flaggedImages = imageResults.filter((img) => img.flagged);
      if (flaggedImages.length > 0) {
        reasons.push(`NSFW image detected (${flaggedImages.length} image(s))`);
        moderationScore += 0.8; // Very high weight for NSFW images
      }
    } catch (error) {
      console.error('Image URL moderation error (non-blocking):', error);
      // Don't block if image moderation fails
    }
  }

  // Determine final status
  const flagged = moderationScore > 0.5; // Threshold: 50% confidence
  const approved = moderationScore < 0.3; // Low score = auto-approve
  const needsReview = flagged && !approved; // Medium score = needs review

  let moderationStatus: ModerationResult['moderationStatus'];
  if (approved) {
    moderationStatus = 'approved';
  } else if (moderationScore > 0.8) {
    // Very high score = auto-reject
    moderationStatus = 'rejected';
  } else if (needsReview) {
    moderationStatus = 'needs_review';
  } else {
    moderationStatus = 'pending';
  }

  return {
    flagged,
    approved,
    moderationStatus,
    moderationScore: Math.min(1, moderationScore), // Cap at 1.0
    reasons,
    details,
  };
}

/**
 * Moderate a single image URL (downloads and moderates)
 */
export async function moderateImageUrl(imageUrl: string): Promise<{
  flagged: boolean;
  isNSFW: boolean;
  scores: any;
  reason?: string;
}> {
  try {
    // Download image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Moderate image
    return await moderateImage(buffer);
  } catch (error) {
    console.error('Error moderating image URL:', error);
    // Fail open - don't block if moderation fails
    return {
      flagged: false,
      isNSFW: false,
      scores: {
        porn: 0,
        sexy: 0,
        hentai: 0,
        drawing: 0,
        neutral: 1,
      },
    };
  }
}

