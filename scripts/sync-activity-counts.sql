-- Sync activity_feed like_count and comment_count with actual data
-- This script updates the counts for existing activities

-- Update like_count based on activity_feed_likes table
UPDATE activity_feed 
SET like_count = (
  SELECT COUNT(*) 
  FROM activity_feed_likes 
  WHERE activity_feed_likes.activity_id = activity_feed.id
)
WHERE id IN (
  SELECT DISTINCT activity_id 
  FROM activity_feed_likes
);

-- Update comment_count based on activity_comments table
UPDATE activity_feed 
SET comment_count = (
  SELECT COUNT(*) 
  FROM activity_comments 
  WHERE activity_comments.activity_id = activity_feed.id
)
WHERE id IN (
  SELECT DISTINCT activity_id 
  FROM activity_comments
);

-- Set counts to 0 for activities that have no likes/comments but have null counts
UPDATE activity_feed 
SET like_count = 0 
WHERE like_count IS NULL;

UPDATE activity_feed 
SET comment_count = 0 
WHERE comment_count IS NULL;

-- Show summary of the sync
SELECT 
  'Total activities' as metric,
  COUNT(*) as count
FROM activity_feed
UNION ALL
SELECT 
  'Activities with likes' as metric,
  COUNT(*) as count
FROM activity_feed
WHERE like_count > 0
UNION ALL
SELECT 
  'Activities with comments' as metric,
  COUNT(*) as count
FROM activity_feed
WHERE comment_count > 0;
