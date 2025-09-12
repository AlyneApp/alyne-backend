import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
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

    // First, get all direct conversations where the current user is a participant
    const { data: userConversations, error: userConvError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (userConvError) {
      console.error('Error fetching user conversations:', userConvError);
      return NextResponse.json(
        { error: 'Failed to fetch user conversations' },
        { status: 500 }
      );
    }

    const conversationIds = userConversations?.map(uc => uc.conversation_id) || [];

    if (conversationIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Get the direct conversations with pending request status
    const { data: requests, error } = await supabase
      .from('conversations')
      .select(`
        id,
        name,
        created_at,
        updated_at,
        conversation_type,
        request_status
      `)
      .eq('conversation_type', 'direct')
      .in('id', conversationIds)
      .eq('request_status', 'pending') // Only show pending requests
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching message requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch message requests' },
        { status: 500 }
      );
    }

    // Process all pending conversations (no need to filter by follow relationships)
    const filteredRequests = [];
    
    for (const conversation of requests || []) {
      // Get participants for this conversation
      const { data: participants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select(`
          user_id,
          user:users!conversation_participants_user_id_fkey(
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('conversation_id', conversation.id);

      if (participantsError || !participants) continue;

      // Get the other participant (not the current user)
      const otherParticipant = participants.find(
        (p: any) => p.user_id !== user.id
      );
      
      if (!otherParticipant) continue;

      // Get the last message for this conversation
      const { data: lastMessage } = await supabase
        .from('messages')
        .select('id, content, sender_id, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      filteredRequests.push({
        id: conversation.id,
        name: conversation.name || (otherParticipant.user as any).full_name || (otherParticipant.user as any).username,
        last_message: lastMessage?.content || 'No message',
        last_message_at: lastMessage?.created_at || conversation.updated_at,
        last_message_sender_id: lastMessage?.sender_id,
        other_user: {
          id: (otherParticipant.user as any).id,
          username: (otherParticipant.user as any).username,
          full_name: (otherParticipant.user as any).full_name,
          avatar_url: (otherParticipant.user as any).avatar_url,
        },
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
      });
    }

    return NextResponse.json({
      success: true,
      data: filteredRequests,
    });

  } catch (error) {
    console.error('Message requests API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Accept a message request (follow the other user back)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const { conversationId, action } = await request.json();

    if (!conversationId || !action) {
      return NextResponse.json({ error: 'conversationId and action are required' }, { status: 400 });
    }

    // Get the other participant
    const { data: participants, error: participantsError } = await supabase
      .from('conversation_participants')
      .select(`
        user_id,
        user:users!conversation_participants_user_id_fkey(
          id
        )
      `)
      .eq('conversation_id', conversationId);

    if (participantsError || !participants) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const otherParticipant = participants.find(
      (p: any) => p.user_id !== user.id
    );

    if (!otherParticipant) {
      return NextResponse.json({ error: 'Other participant not found' }, { status: 404 });
    }

    if (action === 'accept') {
      // Check if follow relationship already exists
      const { data: existingFollow } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_id', (otherParticipant.user as any).id)
        .single();

      if (!existingFollow) {
        // Follow the other user back
        const { error: followError } = await supabase
          .from('friends')
          .insert({
            user_id: user.id,
            friend_id: (otherParticipant.user as any).id,
            approved: true
          });

        if (followError) {
          console.error('Error following user:', followError);
          return NextResponse.json({ error: 'Failed to accept request' }, { status: 500 });
        }
      } else {
        // Update existing follow to approved
        const { error: updateError } = await supabase
          .from('friends')
          .update({ approved: true })
          .eq('user_id', user.id)
          .eq('friend_id', (otherParticipant.user as any).id);

        if (updateError) {
          console.error('Error updating follow relationship:', updateError);
          return NextResponse.json({ error: 'Failed to accept request' }, { status: 500 });
        }
      }

      // Mark the request as accepted
      const { error: acceptError } = await supabase
        .from('conversations')
        .update({ request_status: 'accepted' })
        .eq('id', conversationId);

      if (acceptError) {
        console.error('Error marking request as accepted:', acceptError);
      }
    } else if (action === 'decline') {
      // Mark the request as declined
      const { error: declineError } = await supabase
        .from('conversations')
        .update({ request_status: 'declined' })
        .eq('id', conversationId);

      if (declineError) {
        console.error('Error marking request as declined:', declineError);
        return NextResponse.json({ error: 'Failed to decline request' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Request ${action}ed successfully`,
    });

  } catch (error) {
    console.error('Message request action API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
