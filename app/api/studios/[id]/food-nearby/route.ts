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

    // Fetch the studio to get its address
    const { data: studio, error } = await supabaseAdmin!
      .from('studios')
      .select('address')
      .eq('id', id)
      .single();

    if (error || !studio?.address) {
      return NextResponse.json(
        { error: 'Studio not found or no address available' },
        { status: 404 }
      );
    }

    // Get Google Places API key from environment
    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
    console.log('Google Places API key loaded:', googleApiKey ? 'YES' : 'NO');
    
    if (!googleApiKey) {
      console.log('No Google Places API key configured');
      return NextResponse.json({ success: true, data: [] });
    }

    // First, geocode the address to get coordinates
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(studio.address)}&key=${googleApiKey}`;
    console.log('Geocoding URL:', geocodeUrl);
    
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();
    
    if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
      console.error('Geocoding failed:', geocodeData.status, geocodeData.error_message);
      return NextResponse.json({ success: true, data: [] });
    }
    
    const location = geocodeData.results[0].geometry.location;
    const coordinates = `${location.lat},${location.lng}`;
    console.log('Geocoded coordinates:', coordinates);
    
    // Define Google Places API response types
    interface GooglePlace {
      place_id: string;
      name: string;
      distance?: number;
      rating?: number;
      price_level?: number;
      vicinity?: string;
      photos?: Array<{
        photo_reference: string;
      }>;
      types?: string[];
    }
    
    // Search for nearby healthy food options using Google Places API with optimized keywords
    const healthyKeywords = [
      'healthy food', 'organic', 'salad bar', 'juice bar', 'smoothie', 'brunch'
    ];
    
    // Search for each healthy keyword using nearbysearch
    const searchPromises = healthyKeywords.map(async (keyword) => {
      try {
        const nearbySearchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates}&radius=2000&type=restaurant&keyword=${encodeURIComponent(keyword)}&key=${googleApiKey}`;
        console.log(`Searching for "${keyword}":`, nearbySearchUrl);
        
        const searchResponse = await fetch(nearbySearchUrl);
        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          console.log(`"${keyword}" search response status:`, searchData.status);
          console.log(`"${keyword}" search results count:`, searchData.results?.length || 0);
          
          if (searchData.status === 'OK' && searchData.results) {
            return searchData.results as GooglePlace[];
          } else {
            console.error(`"${keyword}" search error:`, searchData.status, searchData.error_message);
            return [];
          }
        } else {
          console.error(`"${keyword}" search request failed:`, searchResponse.status, searchResponse.statusText);
          return [];
        }
      } catch (error) {
        console.error(`Error searching for "${keyword}":`, error);
        return [];
      }
    });
    
    // Wait for all searches to complete in parallel
    const searchResults = await Promise.all(searchPromises);
    const allResults = searchResults.flat();
    
    // Remove duplicates based on place_id
    const uniqueResults = allResults.filter((place, index, self) => 
      index === self.findIndex(p => p.place_id === place.place_id)
    );
    
    console.log(`Found ${uniqueResults.length} unique healthy food options`);
    
    // Check if we found any results
    if (uniqueResults.length === 0) {
      console.log('No healthy food places found');
      return NextResponse.json({ success: true, data: [] });
    }

    // Transform the places data for frontend
    const foodPlaces = uniqueResults.slice(0, 15).map((place: GooglePlace) => {
      let imageUrl = null;
      
      // Always try to get photo from Google Places API first
      if (place.photos && place.photos.length > 0) {
        const photo = place.photos[0];
        imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=300&maxheight=200&photo_reference=${photo.photo_reference}&key=${googleApiKey}`;
        console.log(`📸 Using Google Places photo for "${place.name}"`);
      } else {
        // Only if Google doesn't have photos, use a simple placeholder
        imageUrl = null; // Let frontend handle missing images
        console.log(`📸 No Google Places photo available for "${place.name}"`);
      }
      
      return {
        id: place.place_id,
        name: place.name,
        distance: place.distance || 0, // Distance in meters from Google
        unit: 'm away',
        rating: place.rating || null,
        price_level: place.price_level || null,
        vicinity: place.vicinity || '',
        image_url: imageUrl,
      };
    });

    return NextResponse.json({ 
      success: true, 
      data: foodPlaces 
    });
  } catch (error) {
    console.error('Error in food nearby API:', error);
    return NextResponse.json({ success: true, data: [] });
  }
} 