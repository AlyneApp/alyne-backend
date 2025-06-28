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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_studios_featured ON studios(is_featured);
CREATE INDEX IF NOT EXISTS idx_studios_active ON studios(is_active);
CREATE INDEX IF NOT EXISTS idx_studios_location ON studios(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_studios_city ON studios(city);

-- Insert some sample data for testing
INSERT INTO studios (name, description, image_url, address, city, state, latitude, longitude, is_featured, is_active) VALUES
('Soto Method', 'Premium pilates studio with modern equipment and expert instructors', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400', '123 Main St', 'San Francisco', 'CA', 37.7749, -122.4194, true, true),
('Flow Fitness', 'Dynamic yoga and fitness classes in a serene environment', 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400', '456 Oak Ave', 'San Francisco', 'CA', 37.7849, -122.4094, true, true),
('Core Power Studio', 'High-intensity workouts and strength training', 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400', '789 Pine St', 'San Francisco', 'CA', 37.7949, -122.3994, true, true),
('Zen Wellness', 'Holistic approach to fitness with meditation and yoga', 'https://images.unsplash.com/photo-1506629905607-d5b9ce8c5f71?w=400', '321 Elm St', 'San Francisco', 'CA', 37.7649, -122.4294, true, true),
('Urban Athletics', 'Modern gym with state-of-the-art equipment', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400', '654 Cedar Blvd', 'San Francisco', 'CA', 37.7549, -122.4394, true, true);

-- Enable Row Level Security (RLS) if needed
-- ALTER TABLE studios ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to active studios
-- CREATE POLICY "Public studios are viewable by everyone" ON studios
--   FOR SELECT USING (is_active = true); 