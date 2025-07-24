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

    // Get all users who could potentially teach at this studio
    // For now, we'll just get all users and let the frontend handle assignment
    const { data: instructors, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        full_name,
        avatar_url
      `)
      .order('full_name');

    if (error) {
      console.error('Error fetching instructors:', error);
      return NextResponse.json(
        { error: 'Failed to fetch instructors' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: instructors || [],
    });

  } catch (error) {
    console.error('Instructors API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 