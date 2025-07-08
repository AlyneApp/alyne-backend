-- Add comments for actual activity IDs from the database with VARIED counts for testing

-- 4 comments - Most popular post (Prisha's Reformer Pilates)
INSERT INTO activity_comments (activity_id, user_id, content) VALUES
  ('49daaef3-69db-43ee-b445-d84fb1c24c34', '30923960-8c12-43a4-8529-b4a0c95891af', 'This class was incredible! 🔥'),
  ('49daaef3-69db-43ee-b445-d84fb1c24c34', '570e7a85-eb61-43e6-aaa9-81a5530d8ee0', 'Love the reformer pilates! So challenging 💪'),
  ('49daaef3-69db-43ee-b445-d84fb1c24c34', 'eacd6757-b29d-417e-be17-9e58f27d9f9f', 'Kine is such an amazing instructor!'),
  ('49daaef3-69db-43ee-b445-d84fb1c24c34', '38110e40-cd3f-43b9-98cc-59e2e6c3337f', 'Definitely want to try this studio now!');

-- 2 comments - Moderate engagement (Sharanya's Vinyasa Flow)
INSERT INTO activity_comments (activity_id, user_id, content) VALUES
  ('fc458495-5c56-4c57-800a-bb856585b571', 'e93c2d35-8505-4132-bb55-1be031553266', 'Beautiful flow! Need to try this studio 🧘‍♀️'),
  ('fc458495-5c56-4c57-800a-bb856585b571', '38110e40-cd3f-43b9-98cc-59e2e6c3337f', 'Sarah Williams is the best yoga instructor!');

-- 1 comment - Light engagement (Sharanya's studio like)
INSERT INTO activity_comments (activity_id, user_id, content) VALUES
  ('1f58ed54-53d4-4448-b67f-1252bfa332f7', 'e93c2d35-8505-4132-bb55-1be031553266', 'Soto Method is amazing! Great choice 👌');

-- 3 comments - Good engagement (Main user's Sculpt class)
INSERT INTO activity_comments (activity_id, user_id, content) VALUES
  ('1bc8dfbb-f9b1-49e0-92e0-2050a9f99be4', '30923960-8c12-43a4-8529-b4a0c95891af', 'Alex Chen is incredible! Love sculpt classes 🔥'),
  ('1bc8dfbb-f9b1-49e0-92e0-2050a9f99be4', 'e93c2d35-8505-4132-bb55-1be031553266', 'This studio looks amazing! Adding to my list'),
  ('1bc8dfbb-f9b1-49e0-92e0-2050a9f99be4', '38110e40-cd3f-43b9-98cc-59e2e6c3337f', 'Sculpt classes are so tough but so worth it! 💪');

-- 0 comments - No engagement (testuser's Reformer Pilates & main user's Yoga Flow)
-- These posts will have no comments to test the "No comments yet" scenario 