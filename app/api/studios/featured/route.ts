import { NextResponse } from 'next/server';
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

export async function GET(request: Request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type');

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
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(4);

    // Add type filter if specified (wellness spaces)
    if (typeFilter === 'wellness') {
      const wellnessTypes = ['wellness', 'spa', 'massage', 'meditation', 'yoga', 'pilates', 'recovery', 'therapy', 'holistic', 'mindfulness'];
      queryBuilder = queryBuilder.in('type', wellnessTypes);
      console.log('Filtering for wellness types:', wellnessTypes);
    }

    const { data: studios, error } = await queryBuilder;

    if (error) {
      console.error('Error fetching featured studios:', error);
      return NextResponse.json(
        { error: 'Failed to fetch featured studios' },
        { status: 500 }
      );
    }

    console.log(`Found ${studios?.length || 0} featured studios`);
    if (studios && studios.length > 0) {
      console.log('Studio types:', studios.map(s => ({ name: s.name, type: s.type })));
    }

    // Transform the data for frontend compatibility
    const studiosWithDistance = studios?.map((studio: Studio) => {
      // Ensure we only use the address field, not the raw location data
      const cleanAddress = studio.address && studio.address.trim() !== '' 
        ? studio.address 
        : 'Location not specified';
      
      return {
        id: studio.id,
        name: studio.name,
        location: cleanAddress,
        class_type: studio.type || 'Fitness',
        distance: `${Math.floor(Math.random() * 20) + 1} min away`,
        image_url: studio.image_urls?.[0] || null, // Let frontend handle default image
        rating: Number((Math.random() * 1.5 + 3.5).toFixed(1)),
        price_range: ['$$', '$$$', '$$$$'][Math.floor(Math.random() * 3)],
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: studiosWithDistance,
    });

  } catch (error) {
    console.error('Featured studios API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 