import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    // Events coming soon
    return NextResponse.json({
      success: true,
      data: [],
      message: 'Events coming soon',
      metadata: {
        status: 'Success',
        created_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        total_time_taken: 0
      }
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