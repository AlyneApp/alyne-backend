import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify the token and get the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get the user's profile data from the database
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        full_name,
        avatar_url,
        created_at,
        followers_count,
        following_count
      `)
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Get the count of posts this user has made
    const { count: postsCount, error: postsError } = await supabase
      .from('activity_feed')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (postsError) {
      console.error('Error fetching posts count:', postsError);
      // Continue without posts count
    }

    return NextResponse.json({
      success: true,
      data: {
        ...userProfile,
        posts_count: postsCount || 0,
      },
    });

  } catch (error) {
    console.error('Users/me API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 