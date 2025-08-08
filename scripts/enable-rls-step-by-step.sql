-- STEP-BY-STEP RLS ENABLEMENT
-- Run this script in stages to safely enable RLS without breaking functionality

-- STAGE 1: Test RLS on a single table first
-- Uncomment and run this section first to test RLS on users table

/*
-- Enable RLS on users table only
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Basic policies for users table
CREATE POLICY "Users can read own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can read public profiles" ON public.users
    FOR SELECT USING (is_private = false);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Test that everything still works before proceeding
-- Run your app and test user registration, login, and profile updates
*/

-- STAGE 2: Enable RLS on core booking tables
-- Uncomment this section after Stage 1 is working

/*
-- Enable RLS on bookings table
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bookings" ON public.bookings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bookings" ON public.bookings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookings" ON public.bookings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookings" ON public.bookings
    FOR DELETE USING (auth.uid() = user_id);

-- Enable RLS on booking_transfers table
ALTER TABLE public.booking_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transferrers can read own transfers" ON public.booking_transfers
    FOR SELECT USING (auth.uid() = transferrer_id);

CREATE POLICY "Claimers can read claimed transfers" ON public.booking_transfers
    FOR SELECT USING (auth.uid() = claimer_id);

CREATE POLICY "Anyone can read available transfers" ON public.booking_transfers
    FOR SELECT USING (status = 'available');

CREATE POLICY "Users can create transfers" ON public.booking_transfers
    FOR INSERT WITH CHECK (auth.uid() = transferrer_id);

CREATE POLICY "Transferrers can update own transfers" ON public.booking_transfers
    FOR UPDATE USING (auth.uid() = transferrer_id);

CREATE POLICY "Claimers can update claimed transfers" ON public.booking_transfers
    FOR UPDATE USING (auth.uid() = claimer_id);

CREATE POLICY "Transferrers can delete own available transfers" ON public.booking_transfers
    FOR DELETE USING (auth.uid() = transferrer_id AND status = 'available');

-- Test booking functionality before proceeding
*/

-- STAGE 3: Enable RLS on social features
-- Uncomment this section after Stage 2 is working

/*
-- Enable RLS on friends table
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own friendships" ON public.friends
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendship requests" ON public.friends
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own friendship requests" ON public.friends
    FOR UPDATE USING (auth.uid() = friend_id);

CREATE POLICY "Users can delete own friendships" ON public.friends
    FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = to_user_id);

CREATE POLICY "Users can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = to_user_id);

CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE USING (auth.uid() = to_user_id);

-- Test social features before proceeding
*/

-- STAGE 4: Enable RLS on studio and activity tables
-- Uncomment this section after Stage 3 is working

/*
-- Enable RLS on studios table
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read studios" ON public.studios
    FOR SELECT USING (true);

-- Enable RLS on studio_saves table
ALTER TABLE public.studio_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saves" ON public.studio_saves
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own saves" ON public.studio_saves
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saves" ON public.studio_saves
    FOR DELETE USING (auth.uid() = user_id);

-- Enable RLS on activity_feed table
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own activities" ON public.activity_feed
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can read followed users activities" ON public.activity_feed
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM friends 
            WHERE user_id = auth.uid() 
            AND friend_id = activity_feed.user_id 
            AND approved = true
        )
    );

CREATE POLICY "Users can create own activities" ON public.activity_feed
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities" ON public.activity_feed
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activities" ON public.activity_feed
    FOR DELETE USING (auth.uid() = user_id);

-- Test studio and activity features before proceeding
*/

-- STAGE 5: Enable RLS on interaction tables
-- Uncomment this section after Stage 4 is working

/*
-- Enable RLS on activity_comments table
ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all comments" ON public.activity_comments
    FOR SELECT USING (true);

CREATE POLICY "Users can create own comments" ON public.activity_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.activity_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.activity_comments
    FOR DELETE USING (auth.uid() = user_id);

-- Enable RLS on activity_feed_likes table
ALTER TABLE public.activity_feed_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all likes" ON public.activity_feed_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can create own likes" ON public.activity_feed_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON public.activity_feed_likes
    FOR DELETE USING (auth.uid() = user_id);

-- Enable RLS on activity_ratings table
ALTER TABLE public.activity_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all ratings" ON public.activity_ratings
    FOR SELECT USING (true);

CREATE POLICY "Users can create own ratings" ON public.activity_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings" ON public.activity_ratings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ratings" ON public.activity_ratings
    FOR DELETE USING (auth.uid() = user_id);

-- Test all interaction features
*/

-- VERIFICATION QUERIES
-- Run these after each stage to verify RLS is working correctly

-- Check which tables have RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'users', 'bookings', 'booking_transfers', 'friends', 'notifications', 
    'studios', 'studio_saves', 'activity_feed', 'activity_comments', 
    'activity_feed_likes', 'activity_ratings'
)
ORDER BY tablename;

-- Check policies on each table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- EMERGENCY ROLLBACK (if needed)
-- If something breaks, you can disable RLS on specific tables:

/*
-- Disable RLS on a specific table (emergency rollback)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read public profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
*/
