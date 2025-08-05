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
        following_count,
        is_private
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
        can_view_content: true,
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

export async function PATCH(request: NextRequest) {
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

    // Get the request body
    const body = await request.json();
    const { is_private, full_name, username, avatar_url } = body;

    // Build update object with only provided fields
    const updateData: any = {};
    if (typeof is_private === 'boolean') updateData.is_private = is_private;
    if (full_name !== undefined) updateData.full_name = full_name;
    if (username !== undefined) updateData.username = username;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    // Update the user's profile data
    const { data: updatedProfile, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedProfile,
    });

  } catch (error) {
    console.error('Users/me PATCH API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 