-- Add wellness visibility field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS wellness_visible BOOLEAN DEFAULT true;

-- Update existing records to have wellness_visible = true
UPDATE users SET wellness_visible = true WHERE wellness_visible IS NULL; 