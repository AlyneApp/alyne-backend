import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

    const { conversationId, content } = await request.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'Conversation ID and content are required' }, { status: 400 });
    }

    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    console.log('POST /api/messages - User:', user.id, 'Conversation:', conversationId);

    // First check if conversation exists
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, conversation_type')
      .eq('id', conversationId)
      .single();

    if (conversationError || !conversation) {
      console.error('Conversation not found:', conversationError);
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    console.log('Conversation found:', conversation);

    // Check if the current user is a participant
    const { data: participant, error: participantError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (participantError || !participant) {
      console.error('User not participant:', participantError);
      return NextResponse.json({ error: 'You are not part of this conversation' }, { status: 403 });
    }

    // Insert the message
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        sender_id: user.id,
        content: content.trim()
      }])
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        created_at,
        users (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .single();

    if (insertError) {
      console.error('Error inserting message:', insertError);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: message
    });

  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Cap at 100
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    console.log('GET /api/messages - User:', user.id, 'Conversation:', conversationId);

    // First check if conversation exists
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, conversation_type')
      .eq('id', conversationId)
      .single();

    if (conversationError || !conversation) {
      console.error('Conversation not found:', conversationError);
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    console.log('Conversation found:', conversation);

    // Check if the current user is a participant
    const { data: participant, error: participantError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (participantError || !participant) {
      console.error('User not participant:', participantError);
      return NextResponse.json({ error: 'You are not part of this conversation' }, { status: 403 });
    }

    // Get messages for the conversation
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        id,
        conversation_id,
        sender_id,
        content,
        created_at,
        users (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    // Reverse the order to show oldest messages first (for chat UI)
    const orderedMessages = messages?.reverse() || [];

    return NextResponse.json({
      success: true,
      data: orderedMessages
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
