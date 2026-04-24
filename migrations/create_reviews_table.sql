-- Reviews table for the review flow
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id UUID NOT NULL,
  studio_name TEXT NOT NULL,
  studio_type TEXT,
  rating TEXT NOT NULL CHECK (rating IN ('obsessed', 'solid', 'not_for_me')),
  highlights TEXT[] DEFAULT '{}',
  feelings TEXT[] DEFAULT '{}',
  instructor_name TEXT,
  playlist_score REAL,
  intensity_score REAL,
  caption TEXT,
  photos TEXT[] DEFAULT '{}',
  friends TEXT[] DEFAULT '{}',
  is_test BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for feed queries (newest first)
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

-- Index for user's reviews
CREATE INDEX idx_reviews_user_id ON reviews(user_id);

-- Index for studio's reviews
CREATE INDEX idx_reviews_studio_id ON reviews(studio_id);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all reviews (for feed)
CREATE POLICY "Anyone can read reviews" ON reviews
  FOR SELECT USING (true);

-- Allow users to insert their own reviews
CREATE POLICY "Users can create own reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own reviews
CREATE POLICY "Users can delete own reviews" ON reviews
  FOR DELETE USING (auth.uid() = user_id);
