import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the user ID from the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const { id: studioId } = await params;

    // Verify the studio exists
    const { data: studio, error: studioError } = await supabaseAdmin!
      .from('studios')
      .select('id, name')
      .eq('id', studioId)
      .single();

    if (studioError || !studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    // Fetch ratings for this studio
    const { data: ratings, error: ratingsError } = await supabaseAdmin!
      .from('activity_ratings')
      .select(`
        id,
        rating,
        comment,
        created_at,
        user_id
      `)
      .eq('rating_type', 'studio')
      .eq('rated_entity_id', studioId)
      .order('created_at', { ascending: false });

    if (ratingsError) {
      console.error('Error fetching ratings:', ratingsError);
      return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 });
    }

    // Get user IDs from ratings
    const userIds = ratings?.map(rating => rating.user_id) || [];
    
    // Fetch user data separately
    let userData: { [key: string]: { username: string; full_name: string; avatar_url?: string } } = {};
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin!
        .from('users')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds);
      
      if (!usersError && users) {
        userData = users.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {} as { [key: string]: { username: string; full_name: string; avatar_url?: string } });
      }
    }

    // Transform the data to match the expected format
    const transformedRatings = ratings?.map(rating => ({
      id: rating.id,
      rating: rating.rating,
      comment: rating.comment,
      created_at: rating.created_at,
      hasRating: rating.rating !== null,
      hasComment: rating.comment !== null && rating.comment.trim() !== '',
      user: {
        id: rating.user_id,
        username: userData[rating.user_id]?.username || 'Unknown User',
        full_name: userData[rating.user_id]?.full_name,
        avatar_url: userData[rating.user_id]?.avatar_url,
      }
    })) || [];

    return NextResponse.json({
      success: true,
      data: transformedRatings
    });
  } catch (error) {
    console.error('Error in studio ratings GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get the user ID from the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const { id: studioId } = await params;
    const body = await request.json();
    const { rating, comment, photos } = body;
    
    console.log('📸 Rating API - Received data:', { rating, comment, photos, studioId });

    // Validate input
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 10) {
      return NextResponse.json({ error: 'Rating must be a number between 1 and 10' }, { status: 400 });
    }

    // Verify the studio exists
    const { data: studio, error: studioError } = await supabaseAdmin!
      .from('studios')
      .select('id, name')
      .eq('id', studioId)
      .single();

    if (studioError || !studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    // First, create or find an activity feed entry for this user
    let activityId: string;
    
    // Try to find an existing activity feed entry for this user and studio
    const { data: existingActivity } = await supabaseAdmin!
      .from('activity_feed')
      .select('id')
      .eq('user_id', user.id)
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingActivity) {
      activityId = existingActivity.id;
    } else {
      // Create a new activity feed entry
      const { data: newActivity, error: createActivityError } = await supabaseAdmin!
        .from('activity_feed')
        .insert({
          user_id: user.id,
          type: 'studio_visit',
          studio_id: studioId,
          content: `Rated ${studio.name}`,
          visibility: 'public'
        })
        .select('id')
        .single();

      if (createActivityError) {
        console.error('Error creating activity feed entry:', createActivityError);
        return NextResponse.json({ error: 'Failed to create activity entry' }, { status: 500 });
      }

      activityId = newActivity.id;
    }

    // Use upsert to create or update the rating
    const { data: result, error: upsertError } = await supabaseAdmin!
      .from('activity_ratings')
      .upsert({
        user_id: user.id,
        activity_id: activityId,
        rating_type: 'studio',
        rated_entity_id: studioId,
        rating,
        comment: comment || null
      }, {
        onConflict: 'user_id,activity_id,rating_type,rated_entity_id'
      })
      .select('id, rating, comment, created_at')
      .single();

    if (upsertError) {
      console.error('Error upserting rating:', upsertError);
      return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 });
    }
    
    console.log('📸 Rating API - Successfully saved rating:', result);

    // If photos were provided, add them to the studio's image_urls array
    if (photos && photos.length > 0) {
      console.log('📸 Rating API - Adding photos to studio:', photos);
      
      // Get current studio images
      const { data: currentStudio, error: studioFetchError } = await supabaseAdmin!
        .from('studios')
        .select('image_urls')
        .eq('id', studioId)
        .single();

      if (studioFetchError) {
        console.error('Error fetching current studio images:', studioFetchError);
      } else {
        // Merge existing images with new photos, avoiding duplicates
        const currentImages = currentStudio.image_urls || [];
        const newImages = photos.filter((photo: string) => !currentImages.includes(photo));
        const updatedImages = [...currentImages, ...newImages];

        // Update studio with new images
        const { error: updateError } = await supabaseAdmin!
          .from('studios')
          .update({ image_urls: updatedImages })
          .eq('id', studioId);

        if (updateError) {
          console.error('Error updating studio images:', updateError);
        } else {
          console.log('📸 Rating API - Successfully updated studio images:', updatedImages);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        rating: result.rating,
        comment: result.comment,
        created_at: result.created_at
      }
    });
  } catch (error) {
    console.error('Error in studio ratings POST API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 