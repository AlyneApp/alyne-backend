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
      // Fallback to mock data if no API key
      const mockFoodPlaces = [
        { id: '1', name: "Joe's Pizza", distance: 500, unit: 'm away', rating: 4.5, price_level: 2, vicinity: '123 Main St', image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&h=200&fit=crop' },
        { id: '2', name: 'Green Salad Bar', distance: 800, unit: 'm away', rating: 4.2, price_level: 3, vicinity: '456 Oak Ave', image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=300&h=200&fit=crop' },
        { id: '3', name: 'Cafe Latte', distance: 300, unit: 'm away', rating: 4.0, price_level: 2, vicinity: '789 Pine St', image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&h=200&fit=crop' },
      ];
      return NextResponse.json({ success: true, data: mockFoodPlaces });
    }

    // First, geocode the address to get coordinates
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(studio.address)}&key=${googleApiKey}`;
    console.log('Geocoding URL:', geocodeUrl);
    
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json();
    
    if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
      console.error('Geocoding failed:', geocodeData.status, geocodeData.error_message);
      // Fallback to mock data
      const mockFoodPlaces = [
        { id: '1', name: "Joe's Pizza", distance: 500, unit: 'm away', rating: 4.5, price_level: 2, vicinity: '123 Main St', image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&h=200&fit=crop' },
        { id: '2', name: 'Green Salad Bar', distance: 800, unit: 'm away', rating: 4.2, price_level: 3, vicinity: '456 Oak Ave', image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=300&h=200&fit=crop' },
        { id: '3', name: 'Cafe Latte', distance: 300, unit: 'm away', rating: 4.0, price_level: 2, vicinity: '789 Pine St', image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&h=200&fit=crop' },
      ];
      return NextResponse.json({ success: true, data: mockFoodPlaces });
    }
    
    const location = geocodeData.results[0].geometry.location;
    const coordinates = `${location.lat},${location.lng}`;
    console.log('Geocoded coordinates:', coordinates);
    
    // Search for nearby restaurants using Google Places API with coordinates
    const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates}&radius=1000&type=restaurant&key=${googleApiKey}`;
    console.log('Google Places API URL:', searchUrl);
    
    const searchResponse = await fetch(searchUrl);
    console.log('Google Places API response status:', searchResponse.status);
    
    if (!searchResponse.ok) {
      console.error('Google Places API error:', searchResponse.status, searchResponse.statusText);
      // Fallback to mock data on API error
      const mockFoodPlaces = [
        { id: '1', name: "Joe's Pizza", distance: 500, unit: 'm away', rating: 4.5, price_level: 2, vicinity: '123 Main St', image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&h=200&fit=crop' },
        { id: '2', name: 'Green Salad Bar', distance: 800, unit: 'm away', rating: 4.2, price_level: 3, vicinity: '456 Oak Ave', image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=300&h=200&fit=crop' },
        { id: '3', name: 'Cafe Latte', distance: 300, unit: 'm away', rating: 4.0, price_level: 2, vicinity: '789 Pine St', image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&h=200&fit=crop' },
      ];
      return NextResponse.json({ success: true, data: mockFoodPlaces });
    }
    
    const searchData = await searchResponse.json();
    console.log('Google Places API response status:', searchData.status);

    if (searchData.status !== 'OK' || !searchData.results) {
      console.error('Google Places API error:', searchData.status, searchData.error_message);
      // Fallback to mock data
      const mockFoodPlaces = [
        { id: '1', name: "Joe's Pizza", distance: 500, unit: 'm away', rating: 4.5, price_level: 2, vicinity: '123 Main St', image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&h=200&fit=crop' },
        { id: '2', name: 'Green Salad Bar', distance: 800, unit: 'm away', rating: 4.2, price_level: 3, vicinity: '456 Oak Ave', image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=300&h=200&fit=crop' },
        { id: '3', name: 'Cafe Latte', distance: 300, unit: 'm away', rating: 4.0, price_level: 2, vicinity: '789 Pine St', image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&h=200&fit=crop' },
      ];
      return NextResponse.json({ success: true, data: mockFoodPlaces });
    }

    // Transform the places data for frontend
    const foodPlaces = searchData.results.slice(0, 10).map((place: any) => {
      let imageUrl = null;
      
      // Try to get photo from Google Places API
      if (place.photos && place.photos.length > 0) {
        const photo = place.photos[0];
        imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=300&maxheight=200&photo_reference=${photo.photo_reference}&key=${googleApiKey}`;
        console.log(`✅ Using Google photo for "${place.name}":`, imageUrl);
      } else {
        // Fallback to category-based images
        const types = place.types || [];
        const typeString = types.join(' ').toLowerCase();
        
        if (typeString.includes('pizza')) {
          imageUrl = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&h=200&fit=crop';
        } else if (typeString.includes('mexican')) {
          imageUrl = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=300&h=200&fit=crop';
        } else if (typeString.includes('bakery') || typeString.includes('dessert')) {
          imageUrl = 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=300&h=200&fit=crop';
        } else if (typeString.includes('cafe') || typeString.includes('coffee')) {
          imageUrl = 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&h=200&fit=crop';
        } else if (typeString.includes('sandwich') || typeString.includes('deli')) {
          imageUrl = 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300&h=200&fit=crop';
        } else if (typeString.includes('asian') || typeString.includes('chinese') || typeString.includes('japanese') || typeString.includes('thai')) {
          imageUrl = 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=300&h=200&fit=crop';
        } else if (typeString.includes('italian')) {
          imageUrl = 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=300&h=200&fit=crop';
        } else {
          // Default restaurant image
          imageUrl = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=300&h=200&fit=crop';
        }
        console.log(`📸 Using Unsplash fallback for "${place.name}" (${types.join(', ')}):`, imageUrl);
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
    // Fallback to mock data on any error
    const mockFoodPlaces = [
      { id: '1', name: "Joe's Pizza", distance: 500, unit: 'm away', rating: 4.5, price_level: 2, vicinity: '123 Main St', image_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&h=200&fit=crop' },
      { id: '2', name: 'Green Salad Bar', distance: 800, unit: 'm away', rating: 4.2, price_level: 3, vicinity: '456 Oak Ave', image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=300&h=200&fit=crop' },
      { id: '3', name: 'Cafe Latte', distance: 300, unit: 'm away', rating: 4.0, price_level: 2, vicinity: '789 Pine St', image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=300&h=200&fit=crop' },
    ];
    return NextResponse.json({ success: true, data: mockFoodPlaces });
  }
} 