import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify the token and get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get userId from query params, default to current user
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId') || user.id;

    // Get the target user's highest-rated studios
    const { data: ratings, error: ratingsError } = await supabase
      .from('activity_ratings')
      .select(`
        rating,
        rated_entity_id,
        created_at
      `)
      .eq('user_id', targetUserId)
      .eq('rating_type', 'studio')
      .order('rating', { ascending: false })
      .limit(5);

    if (ratingsError) {
      console.error('Error fetching user ratings:', ratingsError);
      return NextResponse.json(
        { error: 'Failed to fetch user ratings' },
        { status: 500 }
      );
    }

    console.log('Found ratings:', ratings);

    if (!ratings || ratings.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Get studio IDs from ratings
    const studioIds = ratings.map(rating => rating.rated_entity_id);

    // Fetch studio data separately
    const { data: studios, error: studiosError } = await supabase
      .from('studios')
      .select(`
        id,
        name,
        address,
        image_urls
      `)
      .in('id', studioIds);

    if (studiosError) {
      console.error('Error fetching studios:', studiosError);
      return NextResponse.json(
        { error: 'Failed to fetch studios' },
        { status: 500 }
      );
    }

    console.log('Found studios:', studios);

    // Create a map of studio data by ID
    const studioMap = studios?.reduce((acc, studio) => {
      acc[studio.id] = studio;
      return acc;
    }, {} as { [key: string]: typeof studios[0] }) || {};

    // Transform the data to include studio information
    const favorites = ratings.map(rating => ({
      id: rating.rated_entity_id,
      rating: rating.rating,
      studio: studioMap[rating.rated_entity_id] || null,
      created_at: rating.created_at,
    })).filter(item => item.studio) || [];

    return NextResponse.json({
      success: true,
      data: favorites,
    });

  } catch (error) {
    console.error('Users/favorites API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 