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
      // Check if the first item is a UUID (user ID) or a string (name)
      const firstInstructor = studio.instructors[0];
      const isUUID = typeof firstInstructor === 'string' && 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstInstructor);
      
      if (isUUID) {
        // If instructors are UUIDs, fetch full user data
        const { data: instructorUsers, error: instructorError } = await supabaseAdmin!
          .from('users')
          .select('id, username, full_name, avatar_url')
          .in('id', studio.instructors);

        if (!instructorError && instructorUsers) {
          instructors = instructorUsers;
        }
      } else {
        // If instructors are names, create instructor objects with the names
        instructors = studio.instructors.map((name: string, index: number) => ({
          id: `name_${index}`,
          username: name.toLowerCase().replace(/\s+/g, '_'),
          full_name: name,
          avatar_url: null
        }));
      }
    }

    // Fetch popular instructor details if popular_instructors field contains user IDs
    let popularInstructors: Array<{
      id: string;
      username: string;
      full_name: string | null;
      avatar_url: string | null;
    }> = [];
    
    if (studio.popular_instructors && Array.isArray(studio.popular_instructors) && studio.popular_instructors.length > 0) {
      // Check if the first item is a UUID (user ID) or a string (name)
      const firstPopularInstructor = studio.popular_instructors[0];
      const isUUID = typeof firstPopularInstructor === 'string' && 
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firstPopularInstructor);
      
      if (isUUID) {
        // If popular_instructors are UUIDs, fetch full user data
        const { data: popularInstructorUsers, error: popularInstructorError } = await supabaseAdmin!
          .from('users')
          .select('id, username, full_name, avatar_url')
          .in('id', studio.popular_instructors);

        if (!popularInstructorError && popularInstructorUsers) {
          popularInstructors = popularInstructorUsers;
        }
      } else {
        // If popular_instructors are names, create instructor objects with the names
        popularInstructors = studio.popular_instructors.map((name: string, index: number) => ({
          id: `popular_${index}`,
          username: name.toLowerCase().replace(/\s+/g, '_'),
          full_name: name,
          avatar_url: null
        }));
      }
    }

    // Transform the data for frontend compatibility
    const transformedStudio = {
      ...studio,
      image_url: studio.image_urls?.[0] || null, // Let frontend handle default image
      image_urls: studio.image_urls || [], // Ensure image_urls is always an array
      website_url: studio.website || null, // Include website URL if available (mapped from 'website' field)
      contact: studio.contact || null, // Include contact number if available
      booking_link: studio.booking_site || null, // Include booking link if available (mapped from 'booking_site' field)
      instructors: instructors, // Include instructor details
      popular_instructors: popularInstructors, // Include popular instructor details
    };

    console.log('Transformed studio data:', {
      id: transformedStudio.id,
      name: transformedStudio.name,
      image_urls: transformedStudio.image_urls,
      image_urls_length: transformedStudio.image_urls?.length,
      instructors: transformedStudio.instructors,
      popular_instructors: transformedStudio.popular_instructors
    });

    console.log('📸 Studio API - Raw studio data from DB:', {
      id: studio.id,
      name: studio.name,
      image_urls: studio.image_urls,
      image_urls_length: studio.image_urls?.length,
      instructors: studio.instructors,
      popular_instructors: studio.popular_instructors
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