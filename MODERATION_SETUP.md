# Free Content Moderation Setup Guide

This guide explains how to set up the free content moderation system for Alyne.

## Overview

The moderation system uses **completely free** tools:
- **NSFW.js** - Free image moderation (NSFW detection)
- **Hugging Face Inference API** - Free text moderation (free tier: 1,000 requests/day)
- **Keyword filtering** - Custom keyword list (free, instant)
- **Community reporting** - Already implemented

## Setup Steps

### 1. Run Database Migration

Execute the SQL migration to add moderation columns and tables:

```sql
-- Run this in your Supabase SQL Editor
-- File: database/moderation_schema.sql
```

This will:
- Add moderation columns to `activity_feed` table
- Create `content_moderation_queue` table for admin review
- Add necessary indexes

### 2. Optional: Hugging Face API Token (for better text moderation)

The system works without a token, but you get better rate limits with one:

1. Sign up at https://huggingface.co (free)
2. Create an API token at https://huggingface.co/settings/tokens
3. Add to your `.env.local`:
   ```
   HUGGINGFACE_API_TOKEN=your_token_here
   ```

**Note**: Without a token, you're limited to ~1,000 requests/day on the free tier. With a token, you get more requests.

### 3. How It Works

#### Image Moderation
- **When**: During image upload (`/api/upload/activity-photos`)
- **How**: NSFW.js analyzes images before they're stored
- **Action**: Blocks NSFW images immediately
- **Cost**: $0 (runs on your server)

#### Text Moderation
- **When**: After activity is created (async)
- **How**: 
  1. Keyword filtering (instant, free)
  2. Hugging Face API (if available, free tier)
  3. Simple heuristics (fallback)
- **Action**: Flags content for review or auto-approves/rejects
- **Cost**: $0

#### Activity Moderation
- **When**: After activity feed entry is created
- **How**: Combines text + image moderation
- **Action**: 
  - Auto-approve if score < 0.3
  - Auto-reject if score > 0.8
  - Flag for review if 0.3 < score < 0.8
- **Cost**: $0

## Moderation Statuses

- `pending` - Not yet moderated (default for new posts)
- `approved` - Passed moderation, visible in feed
- `rejected` - Failed moderation, hidden from feed
- `needs_review` - Flagged for admin review

## Feed Filtering

The feed API automatically filters out:
- Content with `moderation_status = 'rejected'`
- Only shows `approved`, `pending`, or `null` (legacy posts)

## Admin Review Queue

Flagged content is automatically added to `content_moderation_queue` for admin review.

### API Endpoints

- `GET /api/moderation/queue` - Get items in queue
- `PATCH /api/moderation/queue/[id]` - Approve/reject/dismiss items

### Frontend Usage

```typescript
import { moderation } from '@/utils/api';

// Get pending items
const queue = await moderation.getQueue(authToken, 'pending');

// Approve an item
await moderation.reviewItem(authToken, queueId, 'approve');

// Reject an item
await moderation.reviewItem(authToken, queueId, 'reject');
```

## Customization

### Adjust Keyword List

Edit `alyne-backend/lib/moderation/keywords.ts`:
- Add/remove keywords from `objectionableKeywords` array
- Add bypass patterns to `bypassPatterns` array

### Adjust Moderation Thresholds

Edit `alyne-backend/lib/moderation/index.ts`:
- Change `threshold` in `moderateImage()` (default: 0.5)
- Change score thresholds in `moderateActivity()`:
  - Auto-approve: `< 0.3`
  - Needs review: `0.3 - 0.8`
  - Auto-reject: `> 0.8`

### Change Moderation Model

Edit `alyne-backend/lib/moderation/text.ts`:
- Change `DEFAULT_MODEL` to use a different Hugging Face model
- Available models:
  - `unitary/toxic-bert` (default)
  - `martin-ha/toxic-comment-classifier`
  - `facebook/roberta-hate-speech-dynabench-r4-target`

## Troubleshooting

### NSFW.js Model Not Loading

- First load takes time (model downloads ~25MB)
- Ensure `@tensorflow/tfjs-node` is installed
- Check server logs for errors

### Hugging Face API Errors

- Free tier has rate limits
- System falls back to simple keyword filtering
- Add `HUGGINGFACE_API_TOKEN` for better limits

### Images Not Being Moderated

- Check that image upload goes through `/api/upload/activity-photos`
- Verify NSFW.js is installed: `yarn list nsfwjs`
- Check server logs for moderation errors

## Cost Summary

- **NSFW.js**: $0 (runs locally)
- **Hugging Face**: $0 (free tier)
- **Keyword filtering**: $0 (custom code)
- **Database**: $0 (uses existing Supabase)

**Total Cost: $0** ✅

## Next Steps

1. Run the database migration
2. (Optional) Add Hugging Face token
3. Test by uploading an image or creating a post
4. Check moderation queue for flagged content
5. Build admin dashboard to review queue (optional)

