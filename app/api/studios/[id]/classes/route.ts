import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studioId } = await params;

    if (!studioId) {
      return NextResponse.json(
        { error: 'Studio ID is required' },
        { status: 400 }
      );
    }

    // Get classes for the specific studio
    const { data: classes, error } = await supabase
      .from('classes')
      .select(`
        id,
        name,
        description,
        duration,
        difficulty_level,
        class_type,
        max_capacity,
        price
      `)
      .eq('studio_id', studioId)
      .order('name');

    if (error) {
      console.error('Error fetching classes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch classes' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: classes || [],
    });

  } catch (error) {
    console.error('Classes API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 