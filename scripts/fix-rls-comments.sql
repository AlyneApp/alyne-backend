-- IMMEDIATE FIX: Disable RLS temporarily to get comments working
-- Run this in Supabase SQL Editor

-- Step 1: Disable RLS temporarily
ALTER TABLE public.activity_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed_likes DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies
DROP POLICY IF EXISTS "Allow read all comments" ON public.activity_comments;
DROP POLICY IF EXISTS "Users can create own comments" ON public.activity_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.activity_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.activity_comments;
DROP POLICY IF EXISTS "Users can read all comments" ON public.activity_comments;
DROP POLICY IF EXISTS "Users can create their own comments" ON public.activity_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.activity_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.activity_comments;
DROP POLICY IF EXISTS "Anyone can read comments" ON public.activity_comments;
DROP POLICY IF EXISTS "Users can read own comments" ON public.activity_comments;

DROP POLICY IF EXISTS "Allow read all likes" ON public.activity_feed_likes;
DROP POLICY IF EXISTS "Users can create own likes" ON public.activity_feed_likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON public.activity_feed_likes;
DROP POLICY IF EXISTS "Users can read all likes" ON public.activity_feed_likes;
DROP POLICY IF EXISTS "Users can create their own likes" ON public.activity_feed_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.activity_feed_likes;
DROP POLICY IF EXISTS "Anyone can read likes" ON public.activity_feed_likes;
DROP POLICY IF EXISTS "Users can read own likes" ON public.activity_feed_likes;

-- Step 3: Re-enable RLS with correct policies
ALTER TABLE public.activity_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed_likes ENABLE ROW LEVEL SECURITY;

-- Step 4: Create new policies
CREATE POLICY "Allow read all comments" ON public.activity_comments
    FOR SELECT USING (true);

CREATE POLICY "Users can create own comments" ON public.activity_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.activity_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.activity_comments
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Allow read all likes" ON public.activity_feed_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can create own likes" ON public.activity_feed_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON public.activity_feed_likes
    FOR DELETE USING (auth.uid() = user_id);

-- Step 5: Verify
SELECT 'RLS Status:' as info;
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('activity_comments', 'activity_feed_likes');

SELECT 'Policies Created:' as info;
SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('activity_comments', 'activity_feed_likes');
