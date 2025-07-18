import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch users who saved this studio
    const { data: saves, error } = await supabaseAdmin!
      .from('studio_saves')
      .select(`
        user_id,
        users (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('studio_id', id);

    if (error) {
      console.error('Error fetching studio saves:', error);
      return NextResponse.json(
        { error: 'Failed to fetch studio saves' },
        { status: 500 }
      );
    }

    // Filter out any null users and format the response
    const users = saves
      ?.filter((save: any) => save.users)
      .map((save: any) => save.users)
      .filter(Boolean) || [];

    return NextResponse.json({ 
      success: true, 
      data: users 
    });
  } catch (error) {
    console.error('Error in studio saves API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 