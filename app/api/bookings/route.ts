import { NextRequest, NextResponse } from 'next/server';
import { supabase, createAuthenticatedClient } from '@/lib/supabase';

interface CreateBookingRequest {
  studio_id: string;
  class_id?: string;
  class_name: string;
  instructor_name?: string;
  start_time: string;
  end_time: string;
  price?: number;
  booking_type?: 'SOLO' | 'GROUP';
  booking_id?: string;
  location?: string;
  companions?: string[]; // Array of user IDs who are going together
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const authenticatedSupabase = createAuthenticatedClient(token);

    // Verify the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const body: CreateBookingRequest = await request.json();

    // Validate required fields
    if (!body.studio_id || !body.class_name || !body.start_time || !body.end_time) {
      return NextResponse.json(
        { error: 'Missing required fields: studio_id, class_name, start_time, end_time' },
        { status: 400 }
      );
    }

    // Create the booking
    const { data: booking, error: bookingError } = await authenticatedSupabase
      .from('bookings')
      .insert({
        user_id: user.id,
        studio_id: body.studio_id,
        class_id: body.class_id,
        class_name: body.class_name,
        instructor_name: body.instructor_name,
        start_time: body.start_time,
        end_time: body.end_time,
        price: body.price || 0.00,
        booking_type: body.booking_type || 'SOLO',
        booking_id: body.booking_id,
        location: body.location,
        companions: body.companions || [],
        status: 'confirmed'
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      
      // Check if the error is due to missing table
      if (bookingError.message && bookingError.message.includes('relation "bookings" does not exist')) {
        return NextResponse.json(
          { error: 'Bookings table not found. Please run the database migration first.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: booking
    });

  } catch (error) {
    console.error('Bookings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const authenticatedSupabase = createAuthenticatedClient(token);

    // Verify the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get userId from query params, default to current user
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId') || user.id;

    // Get user's bookings with studio information
    const { data: bookings, error: bookingsError } = await authenticatedSupabase
      .from('bookings')
      .select(`
        id,
        class_name,
        instructor_name,
        start_time,
        end_time,
        price,
        booking_type,
        booking_id,
        status,
        location,
        created_at,
        companions,
        studios (
          id,
          name,
          address,
          image_urls
        )
      `)
      .eq('user_id', targetUserId)
      .order('start_time', { ascending: false });

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      return NextResponse.json(
        { error: 'Failed to fetch bookings' },
        { status: 500 }
      );
    }

    // Transform the data to match the frontend interface
    const transformedBookings = bookings?.map(booking => {
      const studio = Array.isArray(booking.studios) ? booking.studios[0] : booking.studios;
      return {
        id: booking.id,
        studioName: studio?.name || 'Unknown Studio',
        className: booking.class_name,
        instructorName: booking.instructor_name || 'Unknown Instructor',
        date: new Date(booking.start_time).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }).toUpperCase(),
        time: new Date(booking.start_time).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        }).toUpperCase(),
        price: `$${booking.price?.toFixed(2) || '0.00'}`,
        bookingType: booking.booking_type?.toUpperCase() || 'SOLO',
        studioImage: studio?.image_urls?.[0] || null,
        status: booking.status,
        location: booking.location,
        bookingId: booking.booking_id,
        companions: booking.companions || []
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: transformedBookings
    });

  } catch (error) {
    console.error('Bookings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 