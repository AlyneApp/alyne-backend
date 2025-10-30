import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest, context: any) {
  try {
    const { id } = context.params || {};

    if (!id) {
      return NextResponse.json(
        { error: 'Instructor ID is required' },
        { status: 400 }
      );
    }

    // Fetch instructor details
    const { data: instructorDetails, error: instructorError } = await supabase
      .from('instructor_details')
      .select('*')
      .eq('user_id', id)
      .single();

    if (instructorError) {
      console.error('Error fetching instructor details:', instructorError);
      return NextResponse.json(
        { error: 'Failed to fetch instructor details' },
        { status: 500 }
      );
    }

    if (!instructorDetails) {
      return NextResponse.json(
        { error: 'Instructor details not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: instructorDetails.id,
        user_id: instructorDetails.user_id,
        specialty_descriptor: instructorDetails.specialty_descriptor,
        studios: instructorDetails.studios,
        bio: instructorDetails.bio,
        certifications: instructorDetails.certifications,
        contact_info: instructorDetails.contact_info,
        instagram_handle: instructorDetails.instagram,
        tiktok_handle: instructorDetails.tiktok,
        youtube_channel: instructorDetails.youtube,
        website_url: instructorDetails.website,
        created_at: instructorDetails.created_at,
        updated_at: instructorDetails.updated_at,
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
