import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface Studio {
  id: string;
  name: string;
  description: string | null;
  location: unknown; // PostGIS geography type
  address: string | null;
  image_urls: string[] | null;
  is_featured: boolean | null;
  type: string | null;
  created_at: string;
}

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

    // Get search query and type filter from URL parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const typeFilter = searchParams.get('type');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    console.log('🔍 Searching for studios with query:', query);

    // Build the query
    let queryBuilder = supabase
      .from('studios')
      .select(`
        id,
        name,
        description,
        location,
        address,
        image_urls,
        is_featured,
        type,
        created_at
      `)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,address.ilike.%${query}%`);

    // Add type filter if specified (wellness spaces)
    if (typeFilter) {
      const wellnessTypes = ['wellness', 'spa', 'massage', 'meditation', 'yoga', 'pilates', 'recovery', 'therapy', 'holistic', 'mindfulness'];
      queryBuilder = queryBuilder.in('type', wellnessTypes);
    }

    const { data: studios, error: searchError } = await queryBuilder
      .limit(10)
      .order('name');

    if (searchError) {
      console.error('❌ Error searching studios:', searchError);
      return NextResponse.json(
        { error: 'Failed to search studios' },
        { status: 500 }
      );
    }

    if (!studios || studios.length === 0) {
      console.log('📭 No studios found for query:', query);
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    console.log('🏢 Found studios:', studios.map(s => ({ name: s.name, id: s.id, type: s.type })));

    // Transform the data for frontend compatibility
    const studiosWithDistance = studios.map((studio: Studio) => ({
      id: studio.id,
      name: studio.name,
      location: studio.address || 'Location not specified',
      class_type: studio.type || 'Fitness',
      distance: `${Math.floor(Math.random() * 20) + 1} min away`,
      image_url: studio.image_urls?.[0] || 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=400&q=80',
      rating: Number((Math.random() * 1.5 + 3.5).toFixed(1)), // Random rating between 3.5-5.0
      price_range: ['$$', '$$$', '$$$$'][Math.floor(Math.random() * 3)], // Random price range
    }));

    return NextResponse.json({
      success: true,
      data: studiosWithDistance,
    });

  } catch (error) {
    console.error('❌ Studio search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 