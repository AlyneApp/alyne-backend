import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Get all studios
    const { data: studios, error } = await supabase
      .from('studios')
      .select(`
        id,
        name,
        address,
        description,
        type
      `)
      .order('name');

    if (error) {
      console.error('Error fetching studios:', error);
      return NextResponse.json(
        { error: 'Failed to fetch studios' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: studios || [],
    });

  } catch (error) {
    console.error('Studios API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 