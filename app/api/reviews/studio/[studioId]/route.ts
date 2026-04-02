import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// GET - Fetch all reviews for a specific studio
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

    const { data: reviews, error } = await client
      .from('reviews')
      .select('*')
      .eq('studio_id', studioId)
      .eq('is_test', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching studio reviews:', error);
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }

    // Fetch user info for each review
    const userIds = [...new Set(reviews.map((r: any) => r.user_id))];
    let userMap: Record<string, any> = {};

    if (userIds.length > 0) {
      const { data: users } = await client
        .from('users')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds);

      (users || []).forEach((u: any) => {
        userMap[u.id] = u;
      });
    }

    const enrichedReviews = reviews.map((review: any) => ({
      ...review,
      user: userMap[review.user_id] || null,
    }));

    return NextResponse.json({
      success: true,
      data: enrichedReviews,
    });
  } catch (error) {
    console.error('Studio reviews GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
