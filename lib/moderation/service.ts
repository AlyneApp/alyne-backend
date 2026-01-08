// Moderation service - automatically moderates activities after creation
import { supabaseAdmin } from '@/lib/supabase';
import { moderateActivity } from './index';

/**
 * Automatically moderate an activity feed entry after it's created
 * This should be called after an activity is inserted into activity_feed
 */
export async function moderateActivityFeedEntry(activityId: string): Promise<void> {
  try {
    // Fetch the activity
    const { data: activity, error: fetchError } = await supabaseAdmin!
      .from('activity_feed')
      .select('id, user_id, type, extra_data')
      .eq('id', activityId)
      .single();

    if (fetchError || !activity) {
      console.error('Error fetching activity for moderation:', fetchError);
      return;
    }

    const extraData = activity.extra_data as any || {};

    // Extract text content
    const activityData = {
      activity_name: extraData.activity_name,
      class_name: extraData.class_name,
      how_it_went: extraData.how_it_went,
      instructor_name: extraData.instructor_name,
      studio_name: extraData.studio_name,
    };

    // Get image URLs if photos exist
    // const imageUrls: string[] = [];
    // if (extraData.photos && Array.isArray(extraData.photos)) {
    //   for (const photo of extraData.photos) {
    //     if (typeof photo === 'string') {
    //       imageUrls.push(photo);
    //     } else if (photo && typeof photo === 'object' && photo.uri) {
    //       imageUrls.push(photo.uri);
    //     }
    //   }
    // }

    // Always run keyword check first (fastest and most reliable)
    const { checkActivityContent } = await import('./keywords');
    const keywordResult = checkActivityContent(activityData);
    
    // If keywords are flagged, we can short-circuit and skip expensive operations
    if (keywordResult.flagged) {
      console.log('⚠️ Keyword violation detected:', keywordResult);
      const moderationResult = {
        flagged: true,
        approved: false,
        moderationStatus: 'needs_review' as const,
        moderationScore: 0.6,
        reasons: [`Keyword violation in: ${keywordResult.flaggedFields.join(', ')}`],
        details: {
          keywordCheck: keywordResult,
        },
      };
      
      // Update activity with moderation results
      const updateData: any = {
        moderation_status: moderationResult.moderationStatus,
        moderation_score: moderationResult.moderationScore,
        moderation_details: moderationResult.details,
        auto_flagged: true,
        moderated_at: new Date().toISOString(),
      };

      await supabaseAdmin!
        .from('activity_feed')
        .update(updateData)
        .eq('id', activityId);

      // Add to moderation queue
      await addToModerationQueue(activityId, moderationResult);
      
      console.log(`✅ Moderated activity ${activityId} (keyword violation):`, moderationResult);
      return;
    }

    // Moderate the activity (full check - text only, no image moderation)
    let moderationResult;
    try {
      moderationResult = await moderateActivity(activityData);
    } catch (modError) {
      console.error('Error in moderateActivity:', modError);
      // If moderation fails, use keyword result (already checked above)
      moderationResult = {
        flagged: false,
        approved: true,
        moderationStatus: 'pending' as const,
        moderationScore: 0,
        reasons: [],
        details: {
          keywordCheck: keywordResult,
        },
      };
    }

    // Update activity with moderation results
    const updateData: any = {
      moderation_status: moderationResult.moderationStatus,
      moderation_score: moderationResult.moderationScore,
      moderation_details: moderationResult.details,
      auto_flagged: moderationResult.flagged,
      moderated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin!
      .from('activity_feed')
      .update(updateData)
      .eq('id', activityId);

    if (updateError) {
      console.error('Error updating activity moderation status:', updateError);
      return;
    }

    // If flagged and needs review, add to moderation queue
    if (moderationResult.moderationStatus === 'needs_review' || moderationResult.flagged) {
      await addToModerationQueue(activityId, moderationResult);
    }

    console.log(`✅ Moderated activity ${activityId}:`, {
      status: moderationResult.moderationStatus,
      score: moderationResult.moderationScore,
      flagged: moderationResult.flagged,
    });
  } catch (error) {
    console.error('Error moderating activity feed entry:', error);
    // Don't throw - moderation failures shouldn't break activity creation
  }
}

/**
 * Add activity to moderation queue
 */
async function addToModerationQueue(
  activityId: string,
  moderationResult: any
): Promise<void> {
  try {
    // Check if already in queue
    const { data: existing } = await supabaseAdmin!
      .from('content_moderation_queue')
      .select('id')
      .eq('activity_id', activityId)
      .eq('status', 'pending')
      .single();

    if (existing) {
      // Update existing
      await supabaseAdmin!
        .from('content_moderation_queue')
        .update({
          flagged_reason: moderationResult.reasons.join('; '),
          moderation_score: moderationResult.moderationScore,
          moderation_details: moderationResult.details,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      return;
    }

    // Create new queue item
    await supabaseAdmin!
      .from('content_moderation_queue')
      .insert({
        activity_id: activityId,
        flagged_reason: moderationResult.reasons.join('; '),
        moderation_score: moderationResult.moderationScore,
        moderation_details: moderationResult.details,
        status: 'pending',
      });
  } catch (error) {
    console.error('Error adding to moderation queue:', error);
  }
}


