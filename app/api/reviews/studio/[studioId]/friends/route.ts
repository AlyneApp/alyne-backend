import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// GET - Fetch up to 5 friends (people the current user follows) who have reviewed a studio
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studioId: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const { studioId } = await params;
    const client = supabaseAdmin || supabase;

    // Get the IDs of users that the current user follows (approved only)
    const { data: following, error: followingError } = await client
      .from('friends')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('approved', true);

    if (followingError) {
      console.error('Error fetching following list:', followingError);
      return NextResponse.json({ error: 'Failed to fetch following list' }, { status: 500 });
    }

    const followingIds = (following || []).map((f: any) => f.friend_id);

    if (followingIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Find reviews for this studio by followed users
    const { data: reviews, error: reviewsError } = await client
      .from('reviews')
      .select('user_id')
      .eq('studio_id', studioId)
      .eq('is_test', false)
      .in('user_id', followingIds)
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Error fetching friend reviews:', reviewsError);
      return NextResponse.json({ error: 'Failed to fetch friend reviews' }, { status: 500 });
    }

    // Deduplicate user IDs, keep order, limit to 5
    const seenIds = new Set<string>();
    const uniqueUserIds: string[] = [];
    for (const review of reviews || []) {
      if (!seenIds.has(review.user_id)) {
        seenIds.add(review.user_id);
        uniqueUserIds.push(review.user_id);
      }
      if (uniqueUserIds.length === 5) break;
    }

    if (uniqueUserIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Fetch user profiles
    const { data: users, error: usersError } = await client
      .from('users')
      .select('id, username, full_name, avatar_url')
      .in('id', uniqueUserIds);

    if (usersError) {
      console.error('Error fetching user profiles:', usersError);
      return NextResponse.json({ error: 'Failed to fetch user profiles' }, { status: 500 });
    }

    // Return in the same order as uniqueUserIds
    const userMap = Object.fromEntries((users || []).map((u: any) => [u.id, u]));
    const orderedUsers = uniqueUserIds.map((id) => userMap[id]).filter(Boolean);

    return NextResponse.json({ success: true, data: orderedUsers });
  } catch (error) {
    console.error('Friend reviewers GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
