// Main moderation service - combines all moderation methods
import { checkActivityContent } from './keywords';
import { moderateText } from './text';

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
  };
}

/**
 * Moderate activity content (text only)
 */
export async function moderateActivity(data: {
  // Text content
  activity_name?: string;
  class_name?: string;
  how_it_went?: string;
  instructor_name?: string;
  studio_name?: string;
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


