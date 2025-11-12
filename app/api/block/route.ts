import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/block - Block a user
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin!.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const body = await request.json();
    const { blockedUserId } = body;

    if (!blockedUserId) {
      return NextResponse.json({ error: 'blockedUserId is required' }, { status: 400 });
    }

    // Prevent users from blocking themselves
    if (user.id === blockedUserId) {
      return NextResponse.json({ error: 'You cannot block yourself' }, { status: 400 });
    }

    // Verify the user to be blocked exists
    const { data: blockedUser, error: userError } = await supabaseAdmin!
      .from('users')
      .select('id')
      .eq('id', blockedUserId)
      .single();

    if (userError || !blockedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already blocked
    const { data: existingBlock } = await supabaseAdmin!
      .from('blocked_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('blocked_user_id', blockedUserId)
      .single();

    if (existingBlock) {
      return NextResponse.json({ 
        error: 'User is already blocked',
        alreadyBlocked: true 
      }, { status: 400 });
    }

    // Create the block
    const { data: block, error: blockError } = await supabaseAdmin!
      .from('blocked_users')
      .insert({
        user_id: user.id,
        blocked_user_id: blockedUserId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (blockError) {
      console.error('Error creating block:', blockError);
      return NextResponse.json({ error: 'Failed to block user' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: block,
      message: 'User blocked successfully'
    });

  } catch (error: any) {
    console.error('Error in POST /api/block:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/block - Unblock a user
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin!.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const blockedUserId = searchParams.get('blockedUserId');

    if (!blockedUserId) {
      return NextResponse.json({ error: 'blockedUserId is required' }, { status: 400 });
    }

    // Remove the block
    const { error: deleteError } = await supabaseAdmin!
      .from('blocked_users')
      .delete()
      .eq('user_id', user.id)
      .eq('blocked_user_id', blockedUserId);

    if (deleteError) {
      console.error('Error removing block:', deleteError);
      return NextResponse.json({ error: 'Failed to unblock user' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'User unblocked successfully'
    });

  } catch (error: any) {
    console.error('Error in DELETE /api/block:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/block - Get list of blocked users
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin!.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    // Get all blocked users with their user information
    const { data: blockedUsers, error: fetchError } = await supabaseAdmin!
      .from('blocked_users')
      .select(`
        id,
        blocked_user_id,
        created_at,
        blocked_user:blocked_user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching blocked users:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch blocked users' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: blockedUsers || []
    });

  } catch (error: any) {
    console.error('Error in GET /api/block:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

