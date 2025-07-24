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

    // Check if user has this studio saved
    const { data: save } = await supabaseAdmin!
      .from('studio_saves')
      .select('user_id, studio_id')
      .eq('user_id', user.id)
      .eq('studio_id', studioId)
      .single();

    const isSaved = !!save;

    return NextResponse.json({
      success: true,
      data: {
        isSaved,
        studioId,
      }
    });
  } catch (error) {
    console.error('Error in studio saves GET API:', error);
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

    // Verify the studio exists
    const { data: studio, error: studioError } = await supabaseAdmin!
      .from('studios')
      .select('id, name')
      .eq('id', studioId)
      .single();

    if (studioError || !studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    // Check if user already has this studio saved
    const { data: existingSave } = await supabaseAdmin!
      .from('studio_saves')
      .select('user_id, studio_id')
      .eq('user_id', user.id)
      .eq('studio_id', studioId)
      .single();

    let isSaved = false;

    if (existingSave) {
      // Remove the save
      const { error: deleteError } = await supabaseAdmin!
        .from('studio_saves')
        .delete()
        .eq('user_id', user.id)
        .eq('studio_id', studioId);

      if (deleteError) {
        console.error('Error removing studio save:', deleteError);
        return NextResponse.json({ error: 'Failed to remove studio save' }, { status: 500 });
      }

      isSaved = false;
    } else {
      // Add the save
      const { error: insertError } = await supabaseAdmin!
        .from('studio_saves')
        .insert({
          user_id: user.id,
          studio_id: studioId,
        });

      if (insertError) {
        console.error('Error adding studio save:', insertError);
        return NextResponse.json({ error: 'Failed to add studio save' }, { status: 500 });
      }

      // Create activity feed entry for the save
      const { error: feedError } = await supabaseAdmin!
        .from('activity_feed')
        .insert({
          user_id: user.id,
          type: 'studio_favorite',
          studio_id: studioId,
          extra_data: {
            studio_name: studio.name,
          },
        });

      if (feedError) {
        console.error('Error creating activity feed entry:', feedError);
        // Don't fail the whole request if activity feed fails
      }

      isSaved = true;
    }

    return NextResponse.json({
      success: true,
      data: {
        isSaved,
        studioId,
      }
    });
  } catch (error) {
    console.error('Error in studio saves API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 