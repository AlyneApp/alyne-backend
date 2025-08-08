-- Enable RLS on all tables with appropriate policies
-- This script should be run carefully to avoid breaking existing functionality

-- STEP 1: Enable RLS on core tables first
-- 1. USERS TABLE
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile and public profiles of others
CREATE POLICY "Users can read own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can read public profiles" ON public.users
    FOR SELECT USING (is_private = false);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Policy: Users can insert their own profile (during registration)
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. BOOKINGS TABLE
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own bookings
CREATE POLICY "Users can read own bookings" ON public.bookings
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can create their own bookings
CREATE POLICY "Users can create own bookings" ON public.bookings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own bookings
CREATE POLICY "Users can update own bookings" ON public.bookings
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own bookings
CREATE POLICY "Users can delete own bookings" ON public.bookings
    FOR DELETE USING (auth.uid() = user_id);

-- 3. BOOKING_TRANSFERS TABLE
ALTER TABLE public.booking_transfers ENABLE ROW LEVEL SECURITY;

-- Policy: Transferrers can read their own transfers
CREATE POLICY "Transferrers can read own transfers" ON public.booking_transfers
    FOR SELECT USING (auth.uid() = transferrer_id);

-- Policy: Claimers can read transfers they've claimed
CREATE POLICY "Claimers can read claimed transfers" ON public.booking_transfers
    FOR SELECT USING (auth.uid() = claimer_id);

-- Policy: Anyone can read available transfers (for discovery)
CREATE POLICY "Anyone can read available transfers" ON public.booking_transfers
    FOR SELECT USING (status = 'available');

-- Policy: Users can create transfers for their own bookings
CREATE POLICY "Users can create transfers" ON public.booking_transfers
    FOR INSERT WITH CHECK (auth.uid() = transferrer_id);

-- Policy: Transferrers can update their own transfers
CREATE POLICY "Transferrers can update own transfers" ON public.booking_transfers
    FOR UPDATE USING (auth.uid() = transferrer_id);

-- Policy: Claimers can update transfers they've claimed
CREATE POLICY "Claimers can update claimed transfers" ON public.booking_transfers
    FOR UPDATE USING (auth.uid() = claimer_id);

-- Policy: Transferrers can delete their own available transfers
CREATE POLICY "Transferrers can delete own available transfers" ON public.booking_transfers
    FOR DELETE USING (auth.uid() = transferrer_id AND status = 'available');

-- 4. FRIENDS TABLE (Follow/Following relationships)
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own friendships (both directions)
CREATE POLICY "Users can read own friendships" ON public.friends
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Policy: Users can create friendship requests
CREATE POLICY "Users can create friendship requests" ON public.friends
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own friendship requests (approve/deny)
CREATE POLICY "Users can update own friendship requests" ON public.friends
    FOR UPDATE USING (auth.uid() = friend_id);

-- Policy: Users can delete their own friendships
CREATE POLICY "Users can delete own friendships" ON public.friends
    FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 5. NOTIFICATIONS TABLE
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own notifications
CREATE POLICY "Users can read own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = to_user_id);

-- Policy: Users can create notifications (for other users)
CREATE POLICY "Users can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = to_user_id);

-- Policy: Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE USING (auth.uid() = to_user_id);

-- 6. STUDIOS TABLE
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read studio information (public data)
CREATE POLICY "Anyone can read studios" ON public.studios
    FOR SELECT USING (true);

-- 7. STUDIO_SAVES TABLE
ALTER TABLE public.studio_saves ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own saves
CREATE POLICY "Users can read own saves" ON public.studio_saves
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can create their own saves
CREATE POLICY "Users can create own saves" ON public.studio_saves
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own saves
CREATE POLICY "Users can delete own saves" ON public.studio_saves
    FOR DELETE USING (auth.uid() = user_id);

-- STEP 2: Enable RLS on activity-related tables
-- 8. ACTIVITY_FEED TABLE
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own activities
CREATE POLICY "Users can read own activities" ON public.activity_feed
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can read activities from users they follow
CREATE POLICY "Users can read followed users activities" ON public.activity_feed
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM friends 
            WHERE user_id = auth.uid() 
            AND friend_id = activity_feed.user_id 
            AND approved = true
        )
    );

-- Policy: Users can create their own activities
CREATE POLICY "Users can create own activities" ON public.activity_feed
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own activities
CREATE POLICY "Users can update own activities" ON public.activity_feed
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own activities
CREATE POLICY "Users can delete own activities" ON public.activity_feed
    FOR DELETE USING (auth.uid() = user_id);

-- 9. ACTIVITY_COMMENTS TABLE
ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all comments (for activity feeds)
CREATE POLICY "Users can read all comments" ON public.activity_comments
    FOR SELECT USING (true);

-- Policy: Users can create their own comments
CREATE POLICY "Users can create own comments" ON public.activity_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own comments
CREATE POLICY "Users can update own comments" ON public.activity_comments
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON public.activity_comments
    FOR DELETE USING (auth.uid() = user_id);

-- 10. ACTIVITY_FEED_LIKES TABLE
ALTER TABLE public.activity_feed_likes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all likes (for counting)
CREATE POLICY "Users can read all likes" ON public.activity_feed_likes
    FOR SELECT USING (true);

-- Policy: Users can create their own likes
CREATE POLICY "Users can create own likes" ON public.activity_feed_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own likes
CREATE POLICY "Users can delete own likes" ON public.activity_feed_likes
    FOR DELETE USING (auth.uid() = user_id);

-- 11. ACTIVITY_RATINGS TABLE
ALTER TABLE public.activity_ratings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all ratings (for display)
CREATE POLICY "Users can read all ratings" ON public.activity_ratings
    FOR SELECT USING (true);

-- Policy: Users can create their own ratings
CREATE POLICY "Users can create own ratings" ON public.activity_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own ratings
CREATE POLICY "Users can update own ratings" ON public.activity_ratings
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own ratings
CREATE POLICY "Users can delete own ratings" ON public.activity_ratings
    FOR DELETE USING (auth.uid() = user_id);

-- STEP 3: Enable RLS on additional tables (if they exist)
-- Note: Uncomment and modify these sections if you have these tables

-- 12. WELLNESS_EVENTS TABLE (if it exists)
-- ALTER TABLE public.wellness_events ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Anyone can read wellness events" ON public.wellness_events
--     FOR SELECT USING (is_active = true);

-- 13. PAYMENT_METHODS TABLE (if it exists)
-- ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can read own payment methods" ON public.payment_methods
--     FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can create own payment methods" ON public.payment_methods
--     FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can update own payment methods" ON public.payment_methods
--     FOR UPDATE USING (auth.uid() = user_id);
-- CREATE POLICY "Users can delete own payment methods" ON public.payment_methods
--     FOR DELETE USING (auth.uid() = user_id);

-- STEP 4: Verification queries
-- Run these after enabling RLS to verify everything works:

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
