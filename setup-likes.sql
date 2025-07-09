-- Create the likes table with proper constraints
CREATE TABLE IF NOT EXISTS activity_feed_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate likes (user can only like a post once)
  UNIQUE(activity_id, user_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activity_feed_likes_activity ON activity_feed_likes(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_likes_user ON activity_feed_likes(user_id);

-- Function to automatically update like counts
CREATE OR REPLACE FUNCTION update_activity_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Someone liked a post, increment count
    UPDATE activity_feed 
    SET like_count = like_count + 1,
        updated_at = NOW()
    WHERE id = NEW.activity_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Someone unliked a post, decrement count
    UPDATE activity_feed 
    SET like_count = like_count - 1,
        updated_at = NOW()
    WHERE id = OLD.activity_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS activity_feed_like_count_trigger ON activity_feed_likes;
CREATE TRIGGER activity_feed_like_count_trigger
  AFTER INSERT OR DELETE ON activity_feed_likes
  FOR EACH ROW EXECUTE FUNCTION update_activity_like_count();

-- Test the setup
SELECT 'Likes setup complete! Table and triggers created.' as status; 