import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: NextRequest
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

    // Get studio IDs from request body
    const { studioIds } = await request.json();
    
    if (!studioIds || !Array.isArray(studioIds)) {
      return NextResponse.json({ error: 'studioIds array is required' }, { status: 400 });
    }

    // Fetch all saves for the user and the specified studios
    const { data: saves, error } = await supabaseAdmin!
      .from('studio_saves')
      .select('studio_id')
      .eq('user_id', user.id)
      .in('studio_id', studioIds);

    if (error) {
      console.error('Error fetching batch saves:', error);
      return NextResponse.json({ error: 'Failed to fetch saves' }, { status: 500 });
    }

    // Create a set of saved studio IDs for quick lookup
    const savedStudioIds = new Set(saves?.map(save => save.studio_id) || []);

    // Create response object with save status for each studio
    const saveStatus: Record<string, boolean> = {};
    studioIds.forEach(studioId => {
      saveStatus[studioId] = savedStudioIds.has(studioId);
    });

    return NextResponse.json({
      success: true,
      data: saveStatus
    });
  } catch (error) {
    console.error('Error in batch saves API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 