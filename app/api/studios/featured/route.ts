import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Fetch featured studios from the database
    const { data: studios, error } = await supabase
      .from('studios')
      .select(`
        id,
        name,
        description,
        location,
        address,
        image_urls,
        is_featured,
        created_at
      `)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching featured studios:', error);
      return NextResponse.json(
        { error: 'Failed to fetch featured studios' },
        { status: 500 }
      );
    }

    // Transform the data for frontend compatibility
    const studiosWithDistance = studios?.map((studio: any) => ({
      ...studio,
      image_url: studio.image_urls?.[0] || null, // Use first image from array
      distance: Math.floor(Math.random() * 20) + 1, // Random distance 1-20 mins for now
      distance_unit: 'min away'
    })) || [];

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