import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function authenticateUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Authorization header required', user: null };
  }

  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabaseAdmin!.auth.getUser(token);

  if (authError || !user) {
    return { error: 'Invalid authentication token', user: null };
  }

  return { error: null, user };
}

export async function DELETE(request: NextRequest) {
  try {
    const { error: authError, user } = await authenticateUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const userId = user.id;

    // Delete all user-related data in the correct order (respecting foreign key constraints)
    
    // 1. Delete activity feed related data
    const { data: activities } = await supabaseAdmin
      .from('activity_feed')
      .select('id')
      .eq('user_id', userId);

    if (activities && activities.length > 0) {
      const activityIds = activities.map(a => a.id);

      // Delete activity feed likes
      await supabaseAdmin
        .from('activity_feed_likes')
        .delete()
        .in('activity_id', activityIds);

      // Delete activity comments
      await supabaseAdmin
        .from('activity_comments')
        .delete()
        .in('activity_id', activityIds);

      // Delete activity ratings
      await supabaseAdmin
        .from('activity_ratings')
        .delete()
        .in('activity_id', activityIds);

      // Delete activity photos
      await supabaseAdmin
        .from('activity_feed_photos')
        .delete()
        .in('activity_id', activityIds);

      // Delete activity feed entries
      await supabaseAdmin
        .from('activity_feed')
        .delete()
        .eq('user_id', userId);
    }

    // 2. Delete friends/follows relationships
    await supabaseAdmin
      .from('friends')
      .delete()
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    // 3. Delete messages and conversations
    const { data: conversations } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (conversations && conversations.length > 0) {
      const conversationIds = conversations.map(c => c.id);
      
      // Delete messages
      await supabaseAdmin
        .from('messages')
        .delete()
        .in('conversation_id', conversationIds);

      // Delete conversations
      await supabaseAdmin
        .from('conversations')
        .delete()
        .in('id', conversationIds);
    }

    // 4. Delete payment methods
    await supabaseAdmin
      .from('user_payment_methods')
      .delete()
      .eq('user_id', userId);

    // 5. Delete instructor details if exists
    await supabaseAdmin
      .from('instructor_details')
      .delete()
      .eq('user_id', userId);

    // 6. Delete saved studios/places
    await supabaseAdmin
      .from('saved_studios')
      .delete()
      .eq('user_id', userId);

    // 7. Delete favorites
    await supabaseAdmin
      .from('favorites')
      .delete()
      .eq('user_id', userId);

    // 8. Delete been_to_studios
    await supabaseAdmin
      .from('been_to_studios')
      .delete()
      .eq('user_id', userId);

    // 9. Finally, delete the user from the users table
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Error deleting user:', deleteError);
      return NextResponse.json({ error: 'Failed to delete user account' }, { status: 500 });
    }

    // 10. Delete the auth user from Supabase Auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      // Continue even if auth deletion fails, as the database user is already deleted
    }

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/users/delete:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

