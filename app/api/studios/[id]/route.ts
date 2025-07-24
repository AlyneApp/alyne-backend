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

    const { id } = await params;

    // Fetch the studio by ID
    const { data: studio, error } = await supabaseAdmin!
      .from('studios')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching studio:', error);
      return NextResponse.json(
        { error: 'Studio not found' },
        { status: 404 }
      );
    }

    // Fetch instructor details if instructors field contains user IDs
    let instructors: Array<{
      id: string;
      username: string;
      full_name: string | null;
      avatar_url: string | null;
    }> = [];
    if (studio.instructors && Array.isArray(studio.instructors) && studio.instructors.length > 0) {
      const { data: instructorUsers, error: instructorError } = await supabaseAdmin!
        .from('users')
        .select('id, username, full_name, avatar_url')
        .in('id', studio.instructors);

      if (!instructorError && instructorUsers) {
        instructors = instructorUsers;
      }
    }

    // Transform the data for frontend compatibility
    const transformedStudio = {
      ...studio,
      image_url: studio.image_urls?.[0] || 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=400&q=80', // Use first image from array or fallback
      image_urls: studio.image_urls || [], // Ensure image_urls is always an array
      website_url: studio.website || null, // Include website URL if available (mapped from 'website' field)
      contact: studio.contact || null, // Include contact number if available
      booking_link: studio.booking_site || null, // Include booking link if available (mapped from 'booking_site' field)
      instructors: instructors, // Include instructor details
    };

    console.log('Transformed studio data:', {
      id: transformedStudio.id,
      name: transformedStudio.name,
      image_urls: transformedStudio.image_urls,
      image_urls_length: transformedStudio.image_urls?.length
    });

    console.log('📸 Studio API - Raw studio data from DB:', {
      id: studio.id,
      name: studio.name,
      image_urls: studio.image_urls,
      image_urls_length: studio.image_urls?.length
    });

    return NextResponse.json({ 
      success: true, 
      data: transformedStudio 
    });
  } catch (error) {
    console.error('Error in studio API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 