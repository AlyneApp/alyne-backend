import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// POST - Create a new review
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      studioId,
      studioName,
      studioType,
      rating,
      highlights,
      feelings,
      instructorName,
      playlistScore,
      intensityScore,
      caption,
      photos,
      friends,
    } = body;

    if (!studioId || !studioName || !rating) {
      return NextResponse.json({ error: 'studioId, studioName, and rating are required' }, { status: 400 });
    }

    if (!['obsessed', 'loved_it', 'pretty_good', 'it_was_fine', 'not_for_me', 'solid'].includes(rating)) {
      return NextResponse.json({ error: 'Invalid rating value' }, { status: 400 });
    }

    const client = supabaseAdmin || supabase;

    const { data, error } = await client
      .from('reviews')
      .insert({
        user_id: user.id,
        studio_id: studioId,
        studio_name: studioName,
        studio_type: studioType || null,
        rating,
        highlights: highlights || [],
        feelings: feelings || [],
        instructor_name: instructorName || null,
        playlist_score: playlistScore != null ? parseFloat(playlistScore) : null,
        intensity_score: intensityScore != null ? parseFloat(intensityScore) : null,
        caption: caption || null,
        photos: photos || [],
        friends: friends || [],
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating review:', error);
      return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Reviews POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Fetch all reviews for the feed (paginated)
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const client = supabaseAdmin || supabase;

    const { data: reviews, error } = await client
      .from('reviews')
      .select('*')
      .eq('is_test', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
    }

    // Fetch user info for each review
    const userIds = [...new Set(reviews.map((r: any) => r.user_id))];
    const { data: users } = await client
      .from('users')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds);

    const userMap: Record<string, any> = {};
    (users || []).forEach((u: any) => {
      userMap[u.id] = u;
    });

    const enrichedReviews = reviews.map((review: any) => ({
      ...review,
      user: userMap[review.user_id] || null,
    }));

    return NextResponse.json({
      success: true,
      data: enrichedReviews,
      page,
      limit,
      hasMore: reviews.length === limit,
    });
  } catch (error) {
    console.error('Reviews GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
