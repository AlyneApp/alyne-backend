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

    // Get the studios the target user has been to (based on check-in activities)
    const { data: activities, error: activitiesError } = await supabase
      .from('activity_feed')
      .select(`
        studio_id,
        created_at,
        studios (
          id,
          name,
          address,
          image_urls
        )
      `)
      .eq('user_id', targetUserId)
      .eq('type', 'class_checkin')
      .not('studio_id', 'is', null)
      .order('created_at', { ascending: false });

    if (activitiesError) {
      console.error('Error fetching user activities:', activitiesError);
      return NextResponse.json(
        { error: 'Failed to fetch user activities' },
        { status: 500 }
      );
    }

    console.log('Found activities:', activities);

    // Get unique studios (remove duplicates)
    const uniqueStudios = new Map();
    activities?.forEach(activity => {
      if (activity.studio_id && activity.studios && !uniqueStudios.has(activity.studio_id)) {
        uniqueStudios.set(activity.studio_id, {
          id: activity.studio_id,
          studio: activity.studios,
          last_visit: activity.created_at,
        });
      }
    });

    const beenToStudios = Array.from(uniqueStudios.values());

    // Get ratings for these studios
    const studioIds = beenToStudios.map(item => item.id);
    const { data: ratings, error: ratingsError } = await supabase
      .from('activity_ratings')
      .select(`
        rated_entity_id,
        rating
      `)
      .eq('user_id', targetUserId)
      .eq('rating_type', 'studio')
      .in('rated_entity_id', studioIds);

    if (ratingsError) {
      console.error('Error fetching ratings:', ratingsError);
    }

    console.log('Found ratings:', ratings);

    // Create a map of ratings by studio ID
    const ratingMap = new Map();
    ratings?.forEach(rating => {
      ratingMap.set(rating.rated_entity_id, rating.rating);
    });

    // Add ratings to the been to studios data
    const beenToStudiosWithRatings = beenToStudios.map(item => ({
      ...item,
      rating: ratingMap.get(item.id) || null,
    }));

    return NextResponse.json({
      success: true,
      data: beenToStudiosWithRatings,
    });

  } catch (error) {
    console.error('Users/been API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 