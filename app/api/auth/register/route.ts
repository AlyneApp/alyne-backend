import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email, password, username, fullName } = await request.json();

    // Validate input
    if (!email || !password || !username || !fullName) {
      return NextResponse.json(
        { error: 'Email, password, username, and full name are required' },
        { status: 400 }
      );
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error: supabaseAdmin not available' },
        { status: 500 }
      );
    }

    // Create user with Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'User creation failed' },
        { status: 500 }
      );
    }

    // Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authData.user.id,
        email,
        username,
        full_name: fullName,
      }]);

    if (profileError) {
      console.error('Profile creation error:', profileError);
      return NextResponse.json(
        { error: `Profile creation failed: ${profileError.message}` },
        { status: 500 }
      );
    }

    // --- Auto-follow @giuliettavento ---
    try {
      const TARGET_USERNAME = 'giuliettavento';

      // 1. Find the user ID for @giuliettavento (using ilike for case-insensitivity)
      const { data: targetUser } = await supabaseAdmin
        .from('users')
        .select('id, full_name, username')
        .ilike('username', TARGET_USERNAME)
        .single();

      if (targetUser) {
        console.log(`🔍 Found target user ${TARGET_USERNAME} with ID: ${targetUser.id}`);

        // 2. Create the friendship record (new user follows giulettavento)
        const { data: friendship, error: friendshipError } = await supabaseAdmin
          .from('friends')
          .insert({
            user_id: authData.user.id,
            friend_id: targetUser.id,
            approved: true
          })
          .select()
          .single();

        if (friendshipError) {
          console.error(`❌ Friendship creation error:`, friendshipError);
        }

        if (friendship) {
          // 3. Create a notification for @giuliettavento
          const followerName = fullName || username || 'A new user';
          await supabaseAdmin
            .from('notifications')
            .insert({
              type: 'follow_request',
              message: `${followerName} is now following you. Follow back?`,
              from_user_id: authData.user.id,
              to_user_id: targetUser.id,
              related_id: friendship.id,
              is_read: false
            });

          console.log(`✅ Auto-followed ${TARGET_USERNAME} for user ${username}`);
        }
      } else {
        console.warn(`⚠️ User @${TARGET_USERNAME} not found for auto-follow`);
      }
    } catch (followError) {
      // Don't fail registration if auto-follow fails
      console.error('❌ Auto-follow failed:', followError);
    }
    // ----------------------------------

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email,
        username,
        fullName,
      },
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 