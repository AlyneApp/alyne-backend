-- Add collaboration system for workout recordings (simplified)

-- Add collaboration_partners column to activity_feed table
ALTER TABLE activity_feed ADD COLUMN IF NOT EXISTS collaboration_partners JSONB DEFAULT '[]';
 
-- Create index for collaboration_partners
CREATE INDEX IF NOT EXISTS idx_activity_feed_collaboration_partners ON activity_feed USING GIN (collaboration_partners); 