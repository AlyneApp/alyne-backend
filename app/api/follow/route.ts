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

    // Check if friendship already exists (in either direction)
    const { data: existingFriendship, error: checkError } = await supabase
      .from('friends')
      .select('id, approved')
      .or(`and(user_id.eq.${user.id},friend_id.eq.${user_id}),and(user_id.eq.${user_id},friend_id.eq.${user.id})`)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking friendship status:', checkError);
      return NextResponse.json({ error: 'Failed to check friendship status', details: checkError }, { status: 500 });
    }

    if (existingFriendship) {
      // Friendship exists, so remove it
      const { error: unfriendError } = await supabase
        .from('friends')
        .delete()
        .eq('id', existingFriendship.id);

      if (unfriendError) {
        console.error('Error removing friendship:', unfriendError);
        return NextResponse.json({ error: 'Failed to remove friendship' }, { status: 500 });
      }

      // Check new status after removal
      const { data: iFollowData } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_id', user_id)
        .eq('approved', true)
        .maybeSingle();
      const { data: followsMeData } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user_id)
        .eq('friend_id', user.id)
        .eq('approved', true)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        is_following: false,
        i_follow: !!iFollowData,
        follows_me: !!followsMeData,
        message: 'Successfully removed friend'
      });
    } else {
      // No friendship exists, so create one
      const { error: friendError } = await supabase
        .from('friends')
        .insert({
          user_id: user.id,
          friend_id: user_id,
          approved: true // Auto-approve for simplicity
        });

      if (friendError) {
        console.error('Error adding friend:', friendError);
        return NextResponse.json({ error: 'Failed to add friend' }, { status: 500 });
      }

      // Check new status after adding
      const { data: iFollowData } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_id', user_id)
        .eq('approved', true)
        .maybeSingle();
      const { data: followsMeData } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user_id)
        .eq('friend_id', user.id)
        .eq('approved', true)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        is_following: true,
        i_follow: !!iFollowData,
        follows_me: !!followsMeData,
        message: 'Successfully added friend'
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