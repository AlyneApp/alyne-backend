import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// SerpApi Configuration
const SERP_API_KEY = process.env.SERP_API_KEY || '';
const SERP_API_URL = 'https://serpapi.com/search.json';

interface Event {
  title: string;
  date: {
    start_date: string;
    when: string;
  };
  time: string;
  venue: string;
  address: string;
  link: string;
  thumbnail?: string;
  description?: string;
  ticket_info?: string;
  category?: string;
}

interface SerpApiResponse {
  events_results?: Event[];
  search_metadata: {
    status: string;
    created_at: string;
    processed_at: string;
    total_time_taken: number;
  };
  error?: string;
}

async function serpApiCall(params: Record<string, string>): Promise<SerpApiResponse> {
  if (!SERP_API_KEY) {
    throw new Error('SerpApi key not configured');
  }

  const queryParams = new URLSearchParams({
    api_key: SERP_API_KEY,
    ...params,
  });

  const fullUrl = `${SERP_API_URL}?${queryParams.toString()}`;
  
  console.log('🌐 Calling SerpApi with URL:', fullUrl.replace(SERP_API_KEY, '[API_KEY]'));
  
  const response = await fetch(fullUrl);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('SerpApi Error Response:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText.substring(0, 500)
    });
    
    let errorMessage = `SerpApi request failed: ${response.status} ${response.statusText}`;
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error) {
        errorMessage = `SerpApi error: ${errorData.error}`;
      }
    } catch {
      if (errorText.includes('Invalid API key')) {
        errorMessage = 'Invalid SerpApi key';
      } else if (errorText.includes('quota')) {
        errorMessage = 'SerpApi quota exceeded';
      } else if (response.status === 400) {
        errorMessage = 'Invalid request parameters';
      }
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  if (data.error) {
    console.error('SerpApi API Error:', data.error);
    // Don't throw for "no results" errors, just return empty results
    if (data.error.includes("hasn't returned any results")) {
      console.log('📭 No results from SerpApi, returning empty array');
      return {
        events_results: [],
        search_metadata: {
          status: 'Success',
          created_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          total_time_taken: 0
        }
      };
    }
    throw new Error(`SerpApi error: ${data.error}`);
  }
  
  return data;
}

export async function GET(request: NextRequest) {
  try {
    // Get the user ID from the authorization header
    const authHeader = request.headers.get('authorization');
    console.log('🔐 Events API: Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.log('Events API: No authorization header');
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔐 Events API: Token length:', token.length);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError) {
      console.error('Events API: Auth error:', authError);
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }
    
    if (!user) {
      console.log('Events API: No user found');
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }
    
    console.log('Events API: User authenticated:', user.id);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const location = searchParams.get('location') || 'New York, NY';
    const date = searchParams.get('date') || '';
    const category = searchParams.get('category') || '';
    


    if (!SERP_API_KEY) {
      return NextResponse.json(
        { error: 'Events API not configured' },
        { status: 500 }
      );
    }

    const params: Record<string, string> = {
      engine: 'google_events',
    };

    if (query) {
      params.q = query;
    } else if (category) {
      params.q = category;
    } else if (date) {
      // For date filtering, use a simple events query and let client-side handle filtering
      params.q = 'events';
    } else {
      // For location-only searches, use a generic query
      params.q = 'events';
    }
    
    if (location) {
      params.location = location;
    }
    
    // Add date parameter for SerpApi filtering
    if (date) {
      params.date = date;
    }

    console.log('🔍 Searching events with params:', { query, location, date, category });
    
    const response = await serpApiCall(params);
    
    console.log('✅ Found', response.events_results?.length || 0, 'events');

    return NextResponse.json({
      success: true,
      data: response.events_results || [],
      metadata: response.search_metadata
    });

  } catch (error) {
    console.error('Events search error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to search events',
        success: false 
      },
      { status: 500 }
    );
  }
} 