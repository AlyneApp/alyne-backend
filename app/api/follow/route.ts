import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    if (user_id === user.id) {
      return NextResponse.json({ error: 'Cannot add yourself as friend' }, { status: 400 });
    }

    // Check if current user already follows the target user
    const { data: iFollowData } = await supabase
      .from('friends')
      .select('id, approved')
      .eq('user_id', user.id)
      .eq('friend_id', user_id)
      .maybeSingle();

    if (iFollowData) {
      // Current user already follows target user, so remove that friendship
      const { error: unfriendError } = await supabase
        .from('friends')
        .delete()
        .eq('id', iFollowData.id);

      if (unfriendError) {
        console.error('Error removing friendship:', unfriendError);
        return NextResponse.json({ error: 'Failed to remove friendship' }, { status: 500 });
      }

      // Check new status after removal
      const { data: newIFollowData } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_id', user_id)
        .eq('approved', true)
        .maybeSingle();
      const { data: newFollowsMeData } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user_id)
        .eq('friend_id', user.id)
        .eq('approved', true)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        is_following: false,
        i_follow: !!newIFollowData,
        follows_me: !!newFollowsMeData,
        is_pending: false,
        message: 'Successfully removed friend'
      });
    } else {
      // Check if the user being followed has a private account
      const { data: targetUser, error: userError } = await supabase
        .from('users')
        .select('id, username, full_name, is_private')
        .eq('id', user_id)
        .single();

      if (userError || !targetUser) {
        console.error('Error fetching target user:', userError);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Determine if auto-approval should happen
      const shouldAutoApprove = !targetUser.is_private;

      // Create the friendship request
      const { data: newFriendship, error: friendError } = await supabase
        .from('friends')
        .insert({
          user_id: user.id,
          friend_id: user_id,
          approved: shouldAutoApprove
        })
        .select('id')
        .single();

      if (friendError) {
        console.error('Error adding friend:', friendError);
        return NextResponse.json({ error: 'Failed to add friend' }, { status: 500 });
      }

      // Get current user's profile for notification
      const { data: currentUserProfile } = await supabase
        .from('users')
        .select('username, full_name')
        .eq('id', user.id)
        .single();

      const followerName = currentUserProfile?.full_name || currentUserProfile?.username || 'Someone';

      // Create notification for the user being followed
      const notificationMessage = shouldAutoApprove 
        ? `${followerName} is now following you. Follow back?`
        : `${followerName} requested to follow you`;

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          type: shouldAutoApprove ? 'follow' : 'follow_request',
          message: notificationMessage,
          from_user_id: user.id,
          to_user_id: user_id,
          related_id: newFriendship.id,
          is_read: false
        });

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
        // Don't fail the request if notification creation fails
      }

      // Check new status after adding
      const { data: followsMeData } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user_id)
        .eq('friend_id', user.id)
        .eq('approved', true)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        is_following: shouldAutoApprove,
        i_follow: true, // Always true since we just created the relationship
        follows_me: !!followsMeData,
        is_pending: !shouldAutoApprove,
        message: shouldAutoApprove ? 'Successfully added friend' : 'Follow request sent',
        requires_approval: !shouldAutoApprove
      });
    }

  } catch (error) {
    console.error('Friend API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 