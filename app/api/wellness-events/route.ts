import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const location = searchParams.get('location');
    const date = searchParams.get('date');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }

    if (location) {
      query = query.ilike('location', `%${location}%`);
    }

    if (date) {
      query = query.eq('date', date);
    }

    // Execute query
    const { data: events, error, count } = await query;

    if (error) {
      console.error('Error fetching wellness events:', error);
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    // Transform events for frontend
    const transformedEvents = events?.map(event => ({
      id: event.id,
      name: event.name,
      description: event.description,
      location: event.location,
      address: event.address,
      date: event.date,
      time: event.time,
      end_time: event.end_time,
      category: event.category,
      event_type: event.event_type,
      price: event.price,
      currency: event.currency,
      max_capacity: event.max_capacity,
      current_attendees: event.current_attendees,
      organizer: event.organizer,
      organizer_website: event.organizer_website,
      organizer_avatar_url: event.organizer_avatar_url,
      image_url: event.image_url,
      external_url: event.external_url,
      source: event.source,
      is_featured: event.is_featured,
      created_at: event.created_at
    })) || [];

    return NextResponse.json({
      success: true,
      data: transformedEvents,
      pagination: {
        limit,
        offset,
        total: count || transformedEvents.length,
        has_more: (offset + limit) < (count || 0)
      }
    });

  } catch (error) {
    console.error('Wellness events API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { action } = body;

    if (action === 'scrape') {
      // Import and run the scraping function
      const { scrapeAndUpdateEvents } = await import('../../../scripts/scrape-wellness-events');
      
      // Run scraping in background (don't wait for completion)
      scrapeAndUpdateEvents().catch(error => {
        console.error('Background scraping failed:', error);
      });

      return NextResponse.json({
        success: true,
        message: 'Scraping process started in background'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Wellness events POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
