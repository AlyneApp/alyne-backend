import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
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

    // For now, we'll use a simple approach - get all users' studio likes and simulate friends
    // TODO: Once you have a friendships table, replace this with actual friends logic
    
    // Get all studios with their like counts (not favorites), ordered by most likes
    const { data: studioLikes, error } = await supabase
      .from('studio_likes')
      .select(`
        studio_id,
        user_id,
        created_at,
        studios (
          id,
          name,
          description,
          image_urls,
          address,
          location
        )
      `)
      .not('studios', 'is', null);

    if (error) {
      console.error('Error fetching studio likes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch studio likes' },
        { status: 500 }
      );
    }

    if (!studioLikes || studioLikes.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Group by studio and count likes
    const studioLikeCounts = new Map();
    
    studioLikes.forEach((like: any) => {
      if (!like.studios) return;
      
      const studio = like.studios;
      const studioId = studio.id;
      
      if (!studioLikeCounts.has(studioId)) {
        studioLikeCounts.set(studioId, {
          id: studio.id,
          name: studio.name,
          description: studio.description,
          image_url: studio.image_urls?.[0] || null,
          address: studio.address,
          location: studio.location,
          like_count: 0,
          created_at: like.created_at
        });
      }
      
      const studioData = studioLikeCounts.get(studioId);
      studioData.like_count += 1;
    });

    // Convert map to array and sort by like count (descending)
    const sortedStudios = Array.from(studioLikeCounts.values())
      .sort((a, b) => b.like_count - a.like_count)
      .slice(0, 10) // Limit to top 10
      .map(studio => ({
        ...studio,
        distance: Math.floor(Math.random() * 20) + 1, // Random distance for now
        distance_unit: 'min away'
      }));

    return NextResponse.json({
      success: true,
      data: sortedStudios,
    });

  } catch (error) {
    console.error('Friends favorites API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 