-- SAFE RLS ENABLEMENT SCRIPT
-- This script enables RLS with permissive policies that won't break your API

-- USERS TABLE (Fixed)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop any existing restrictive policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read public profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- Create permissive policies for users
CREATE POLICY "Allow read all users" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON public.users
    FOR DELETE USING (auth.uid() = id);

-- BOOKINGS TABLE
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all bookings" ON public.bookings
    FOR SELECT USING (true);

CREATE POLICY "Users can create own bookings" ON public.bookings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookings" ON public.bookings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookings" ON public.bookings
    FOR DELETE USING (auth.uid() = user_id);

-- BOOKING_TRANSFERS TABLE
ALTER TABLE public.booking_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all transfers" ON public.booking_transfers
    FOR SELECT USING (true);

CREATE POLICY "Users can create transfers" ON public.booking_transfers
    FOR INSERT WITH CHECK (auth.uid() = transferrer_id);

CREATE POLICY "Transferrers can update own transfers" ON public.booking_transfers
    FOR UPDATE USING (auth.uid() = transferrer_id);

CREATE POLICY "Claimers can update claimed transfers" ON public.booking_transfers
    FOR UPDATE USING (auth.uid() = claimer_id);

CREATE POLICY "Transferrers can delete own available transfers" ON public.booking_transfers
    FOR DELETE USING (auth.uid() = transferrer_id AND status = 'available');

-- FRIENDS TABLE
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all friendships" ON public.friends
    FOR SELECT USING (true);

CREATE POLICY "Users can create friendship requests" ON public.friends
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own friendship requests" ON public.friends
    FOR UPDATE USING (auth.uid() = friend_id);

CREATE POLICY "Users can delete own friendships" ON public.friends
    FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- NOTIFICATIONS TABLE
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all notifications" ON public.notifications
    FOR SELECT USING (true);

CREATE POLICY "Users can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = to_user_id);

CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE USING (auth.uid() = to_user_id);

-- ACTIVITY_FEED TABLE
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all activities" ON public.activity_feed
    FOR SELECT USING (true);

CREATE POLICY "Users can create own activities" ON public.activity_feed
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities" ON public.activity_feed
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activities" ON public.activity_feed
    FOR DELETE USING (auth.uid() = user_id);

-- ACTIVITY_FEED_LIKES TABLE
ALTER TABLE public.activity_feed_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all likes" ON public.activity_feed_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can create own likes" ON public.activity_feed_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON public.activity_feed_likes
    FOR DELETE USING (auth.uid() = user_id);

-- ACTIVITY_COMMENTS TABLE
ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all comments" ON public.activity_comments
    FOR SELECT USING (true);

CREATE POLICY "Users can create own comments" ON public.activity_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.activity_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.activity_comments
    FOR DELETE USING (auth.uid() = user_id);

-- STUDIOS TABLE
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all studios" ON public.studios
    FOR SELECT USING (true);

-- STUDIO_FAVORITES TABLE
ALTER TABLE public.studio_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all favorites" ON public.studio_favorites
    FOR SELECT USING (true);

CREATE POLICY "Users can create own favorites" ON public.studio_favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorites" ON public.studio_favorites
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" ON public.studio_favorites
    FOR DELETE USING (auth.uid() = user_id);

-- PAYMENT_METHODS TABLE
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payment methods" ON public.payment_methods
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payment methods" ON public.payment_methods
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods" ON public.payment_methods
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment methods" ON public.payment_methods
    FOR DELETE USING (auth.uid() = user_id);

-- WELLNESS_EVENTS TABLE
ALTER TABLE public.wellness_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all wellness events" ON public.wellness_events
    FOR SELECT USING (true);

-- WELLNESS_PRACTICES TABLE
ALTER TABLE public.wellness_practices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all wellness practices" ON public.wellness_practices
    FOR SELECT USING (true);

-- COLLABORATION TABLE
ALTER TABLE public.collaboration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all collaborations" ON public.collaboration
    FOR SELECT USING (true);

CREATE POLICY "Users can create collaborations" ON public.collaboration
    FOR INSERT WITH CHECK (auth.uid() = initiator_id);

CREATE POLICY "Users can update own collaborations" ON public.collaboration
    FOR UPDATE USING (auth.uid() = initiator_id OR auth.uid() = partner_id);

CREATE POLICY "Users can delete own collaborations" ON public.collaboration
    FOR DELETE USING (auth.uid() = initiator_id OR auth.uid() = partner_id);

-- COMMENTS TABLE
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all comments" ON public.comments
    FOR SELECT USING (true);

CREATE POLICY "Users can create own comments" ON public.comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.comments
    FOR DELETE USING (auth.uid() = user_id);

-- LIKES TABLE
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all likes" ON public.likes
    FOR SELECT USING (true);

CREATE POLICY "Users can create own likes" ON public.likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON public.likes
    FOR DELETE USING (auth.uid() = user_id);

-- SEARCH_HISTORY TABLE
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own search history" ON public.search_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own search history" ON public.search_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own search history" ON public.search_history
    FOR DELETE USING (auth.uid() = user_id);

-- UPLOADS TABLE
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own uploads" ON public.uploads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own uploads" ON public.uploads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own uploads" ON public.uploads
    FOR DELETE USING (auth.uid() = user_id);

-- VERIFICATION_CODES TABLE
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own verification codes" ON public.verification_codes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own verification codes" ON public.verification_codes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own verification codes" ON public.verification_codes
    FOR DELETE USING (auth.uid() = user_id);

-- ACTIVITY_RATINGS TABLE
ALTER TABLE public.activity_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all activity ratings" ON public.activity_ratings
    FOR SELECT USING (true);

CREATE POLICY "Users can create own activity ratings" ON public.activity_ratings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activity ratings" ON public.activity_ratings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activity ratings" ON public.activity_ratings
    FOR DELETE USING (auth.uid() = user_id);

-- CLASSES TABLE
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read all classes" ON public.classes
    FOR SELECT USING (true);

CREATE POLICY "Allow insert classes" ON public.classes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update classes" ON public.classes
    FOR UPDATE USING (true);

CREATE POLICY "Allow delete classes" ON public.classes
    FOR DELETE USING (true);

-- ACTIVE_TRANSFERS TABLE (assuming this is a view or table for active transfers)
-- If this is a view, RLS policies are not needed
-- If this is a table, add appropriate policies based on your schema

-- Print summary
SELECT 'RLS enabled on all tables with permissive policies' as status;
