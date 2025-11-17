import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Instructor ID is required' },
        { status: 400 }
      );
    }

    // Ensure instructor exists
    const { data: instructor, error: instructorCheckError } = await supabaseAdmin!
      .from('users')
      .select('id, is_instructor')
      .eq('id', id)
      .eq('is_instructor', true)
      .single();

    if (instructorCheckError || !instructor) {
      return NextResponse.json(
        { error: 'Instructor not found' },
        { status: 404 }
      );
    }

    // Fetch instructor details
    const { data: instructorDetails, error: instructorError } = await supabaseAdmin!
      .from('instructor_details')
      .select('*')
      .eq('user_id', id)
      .maybeSingle();

    if (instructorError) {
      console.error('Error fetching instructor details:', instructorError);
      return NextResponse.json(
        { error: 'Failed to fetch instructor details' },
        { status: 500 }
      );
    }

    // If no details exist, return empty/default structure with proper types
    if (!instructorDetails) {
      return NextResponse.json({
        success: true,
        data: {
          id: '',
          user_id: id,
          specialty_descriptor: '',
          studios: '',
          bio: null,
          certifications: null,
          contact_info: null,
          instagram_handle: null,
          tiktok_handle: null,
          youtube_channel: null,
          website_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: instructorDetails.id || '',
        user_id: instructorDetails.user_id || id,
        specialty_descriptor: instructorDetails.specialty_descriptor || '',
        studios: instructorDetails.studios || '',
        bio: instructorDetails.bio || null,
        certifications: instructorDetails.certifications || null,
        contact_info: instructorDetails.contact_info || null,
        instagram_handle: instructorDetails.instagram || null,
        tiktok_handle: instructorDetails.tiktok || null,
        youtube_channel: instructorDetails.youtube || null,
        website_url: instructorDetails.website || null,
        created_at: instructorDetails.created_at || new Date().toISOString(),
        updated_at: instructorDetails.updated_at || new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Instructor details API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
