-- Studios table for storing fitness studio information
-- This should be created in your Supabase database

CREATE TABLE IF NOT EXISTS studios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,
  zip_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone VARCHAR(20),
  email VARCHAR(255),
  website_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table for storing user profiles
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friends/Following relationships table
CREATE TABLE IF NOT EXISTS friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Activity feed table for storing user activities
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'class_checkin', 'studio_favorite', 'class_transfer', 'studio_like', 'general_post'
  )),
  title TEXT NOT NULL,
  description TEXT,
  studio_id UUID REFERENCES studios(id) ON DELETE SET NULL,
  class_name VARCHAR(255),
  instructor_name VARCHAR(255),
  class_schedule TIMESTAMP WITH TIME ZONE,
  metadata JSONB, -- For additional flexible data
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity feed likes table
CREATE TABLE IF NOT EXISTS activity_feed_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES activity_feed(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(activity_id, user_id)
);

-- Favorites table (studios users want to try)
CREATE TABLE IF NOT EXISTS favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, studio_id)
);

-- Studio likes table (studios users enjoyed)
CREATE TABLE IF NOT EXISTS studio_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  studio_id UUID NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, studio_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_studios_featured ON studios(is_featured);
CREATE INDEX IF NOT EXISTS idx_studios_active ON studios(is_active);
CREATE INDEX IF NOT EXISTS idx_studios_location ON studios(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_studios_city ON studios(city);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

CREATE INDEX IF NOT EXISTS idx_activity_feed_user_id ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_type ON activity_feed(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_studio_id ON activity_feed(studio_id);

CREATE INDEX IF NOT EXISTS idx_activity_likes_activity_id ON activity_feed_likes(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_likes_user_id ON activity_feed_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_studio_id ON favorites(studio_id);

CREATE INDEX IF NOT EXISTS idx_studio_likes_user_id ON studio_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_likes_studio_id ON studio_likes(studio_id);

-- Insert some sample data for testing
INSERT INTO studios (name, description, image_url, address, city, state, latitude, longitude, is_featured, is_active) VALUES
('Soto Method', 'Premium pilates studio with modern equipment and expert instructors', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400', '123 Main St', 'San Francisco', 'CA', 37.7749, -122.4194, true, true),
('Flow Fitness', 'Dynamic yoga and fitness classes in a serene environment', 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400', '456 Oak Ave', 'San Francisco', 'CA', 37.7849, -122.4094, true, true),
('Core Power Studio', 'High-intensity workouts and strength training', 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400', '789 Pine St', 'San Francisco', 'CA', 37.7949, -122.3994, true, true),
('Zen Wellness', 'Holistic approach to fitness with meditation and yoga', 'https://images.unsplash.com/photo-1506629905607-d5b9ce8c5f71?w=400', '321 Elm St', 'San Francisco', 'CA', 37.7649, -122.4294, true, true),
('Urban Athletics', 'Modern gym with state-of-the-art equipment', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400', '654 Cedar Blvd', 'San Francisco', 'CA', 37.7549, -122.4394, true, true);

-- Function to update like counts in activity_feed
CREATE OR REPLACE FUNCTION update_activity_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE activity_feed 
    SET like_count = like_count + 1,
        updated_at = NOW()
    WHERE id = NEW.activity_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE activity_feed 
    SET like_count = like_count - 1,
        updated_at = NOW()
    WHERE id = OLD.activity_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update like counts
CREATE TRIGGER activity_feed_like_count_trigger
  AFTER INSERT OR DELETE ON activity_feed_likes
  FOR EACH ROW EXECUTE FUNCTION update_activity_like_count();

-- Enable Row Level Security (RLS) if needed
-- ALTER TABLE studios ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to active studios
-- CREATE POLICY "Public studios are viewable by everyone" ON studios
--   FOR SELECT USING (is_active = true); 