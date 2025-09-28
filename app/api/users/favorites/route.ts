import { NextRequest, NextResponse } from 'next/server';
import { supabase, createAuthenticatedClient } from '@/lib/supabase';

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

    // Create an authenticated client with the user's JWT token
    const authenticatedSupabase = createAuthenticatedClient(token);

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

    // Get the target user's highest-rated studios (one per studio)
    const { data: ratings, error: ratingsError } = await authenticatedSupabase
      .from('activity_ratings')
      .select(`
        rating,
        rated_entity_id,
        created_at
      `)
      .eq('user_id', targetUserId)
      .eq('rating_type', 'studio')
      .order('rating', { ascending: false });

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

    // Deduplicate studios and keep only the highest rating for each
    const uniqueRatings = ratings.reduce((acc, rating) => {
      const existingRating = acc.find(r => r.rated_entity_id === rating.rated_entity_id);
      if (!existingRating || rating.rating > existingRating.rating) {
        // Remove existing rating for this studio if it exists
        const filtered = acc.filter(r => r.rated_entity_id !== rating.rated_entity_id);
        // Add the new (higher) rating
        return [...filtered, rating];
      }
      return acc;
    }, [] as typeof ratings);

    // Get studio IDs from unique ratings (limit to top 5)
    const studioIds = uniqueRatings.slice(0, 5).map(rating => rating.rated_entity_id);

    // Fetch studio data separately
    const { data: studios, error: studiosError } = await authenticatedSupabase
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
    
    // Debug: Log studio image data
    studios?.forEach(studio => {
      console.log(`Studio ${studio.name}: image_urls =`, studio.image_urls);
    });

    // Create a map of studio data by ID
    const studioMap = studios?.reduce((acc, studio) => {
      acc[studio.id] = studio;
      return acc;
    }, {} as { [key: string]: typeof studios[0] }) || {};

    // Transform the data to include studio information
    const favorites = uniqueRatings.slice(0, 5).map(rating => {
      const studio = studioMap[rating.rated_entity_id];
      if (!studio) return null;
      
      return {
        id: rating.rated_entity_id,
        rating: rating.rating,
        studio: {
          ...studio,
          image_urls: studio.image_urls || [], // Ensure image_urls is always an array
          image_url: studio.image_urls?.[0] || null, // Let frontend handle default image
        },
        created_at: rating.created_at,
      };
    }).filter(item => item !== null) || [];

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