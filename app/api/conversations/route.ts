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

    const { otherUserId, isGroup, groupName, participantIds } = await request.json();

    if (isGroup) {
      // Handle group conversation creation
      if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 2) {
        return NextResponse.json({ error: 'At least 2 participants required' }, { status: 400 });
      }

      // Verify all participants exist
      const { data: participants, error: userError } = await supabase
        .from('users')
        .select('id')
        .in('id', participantIds);

      if (userError || !participants || participants.length !== participantIds.length) {
        return NextResponse.json({ error: 'One or more participants not found' }, { status: 404 });
      }

      // Create group conversation using our database function
      const { data: conversationId, error: conversationError } = await supabase.rpc(
        'create_group_conversation',
        { p_name: groupName || 'New Group Chat', p_created_by: user.id, p_participant_ids: participantIds }
      );

      console.log('Group conversation creation result:', { conversationId, conversationError });

      if (conversationError) {
        console.error('Error creating group conversation:', conversationError);
        return NextResponse.json({ error: 'Failed to create group conversation' }, { status: 500 });
      }

      // Manually insert ALL participants to ensure conversation_participants table is populated
      // First check what participants already exist
      const { data: existingParticipants, error: checkError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (checkError) {
        console.error('Error checking existing participants:', checkError);
      }

      console.log('Existing participants after database function:', existingParticipants);
      console.log('Current user ID:', user.id);
      console.log('Selected participant IDs:', participantIds);

      const existingUserIds = existingParticipants?.map(p => p.user_id) || [];
      
      // Insert all participants that don't already exist
      const participantsToInsert = participantIds
        .filter(userId => !existingUserIds.includes(userId))
        .map(userId => ({
          conversation_id: conversationId,
          user_id: userId
        }));

      if (participantsToInsert.length > 0) {
        console.log('Inserting participants:', participantsToInsert);
        const { error: insertError } = await supabase
          .from('conversation_participants')
          .insert(participantsToInsert);

        if (insertError) {
          console.error('Error inserting participants:', insertError);
        } else {
          console.log('Successfully inserted participants for conversation:', conversationId);
        }
      } else {
        console.log('All participants already exist for conversation:', conversationId);
      }

      // Check final participants after insertion
      const { data: finalParticipants, error: finalCheckError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (finalCheckError) {
        console.error('Error checking final participants:', finalCheckError);
      } else {
        console.log('Final participants after insertion:', finalParticipants);
      }

      // Get the conversation details
      const { data: conversation, error: fetchError } = await supabase
        .from('conversations')
        .select(`
          id,
          conversation_type,
          name,
          created_by,
          created_at,
          updated_at,
          conversation_participants (
            user_id,
            users (
              id,
              username,
              full_name,
              avatar_url
            )
          )
        `)
        .eq('id', conversationId)
        .single();

      console.log('Fetched group conversation:', { conversation, fetchError });

      if (fetchError) {
        console.error('Error fetching group conversation:', fetchError);
        return NextResponse.json({ error: 'Group conversation created but failed to fetch details' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: conversation
      });

    } else {
      // Handle direct conversation creation
      // Support both otherUserId and participantIds for backward compatibility
      let targetOtherUserId = null;
      
      if (otherUserId) {
        // Direct conversation with otherUserId
        if (typeof otherUserId !== 'string') {
          return NextResponse.json({ error: 'Valid other user ID is required' }, { status: 400 });
        }

        if (otherUserId === user.id) {
          return NextResponse.json({ error: 'Cannot create conversation with yourself' }, { status: 400 });
        }
        targetOtherUserId = otherUserId;
      } else if (participantIds && Array.isArray(participantIds) && participantIds.length === 1) {
        // Direct conversation with participantIds (single other user)
        const otherUser = participantIds[0];
        if (otherUser === user.id) {
          return NextResponse.json({ error: 'Cannot create conversation with yourself' }, { status: 400 });
        }
        targetOtherUserId = otherUser;
      } else if (participantIds && Array.isArray(participantIds) && participantIds.length === 2) {
        // Direct conversation with participantIds (for backward compatibility)
        const otherUser = participantIds.find(id => id !== user.id);
        if (!otherUser) {
          return NextResponse.json({ error: 'Valid other user ID is required' }, { status: 400 });
        }
        targetOtherUserId = otherUser;
      } else {
        return NextResponse.json({ error: 'Valid other user ID is required' }, { status: 400 });
      }

      // Verify the other user exists
      const { data: otherUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', targetOtherUserId)
        .single();

      if (userError || !otherUser) {
        return NextResponse.json({ error: 'Other user not found' }, { status: 404 });
      }

      // Get or create direct conversation using our database function
      const { data: conversationId, error: conversationError } = await supabase.rpc(
        'get_or_create_direct_conversation',
        { p_user1_id: user.id, p_user2_id: targetOtherUserId }
      );

      console.log('Direct conversation creation result:', { conversationId, conversationError });

      if (conversationError) {
        console.error('Error creating conversation:', conversationError);
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
      }

      // Manually insert participants to ensure conversation_participants table is populated
      const participantInserts = [
        { conversation_id: conversationId, user_id: user.id },
        { conversation_id: conversationId, user_id: targetOtherUserId }
      ];

      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert(participantInserts);

      if (participantError) {
        console.error('Error inserting participants:', participantError);
        // Don't fail here, just log the error
      }

      console.log('Manually inserted participants for direct conversation:', conversationId);

      // Get the conversation details with user info
      const { data: conversation, error: fetchError } = await supabase
        .from('conversations')
        .select(`
          id,
          conversation_type,
          created_at,
          updated_at,
          conversation_participants (
            user_id,
            users (
              id,
              username,
              full_name,
              avatar_url
            )
          )
        `)
        .eq('id', conversationId)
        .single();

      if (fetchError) {
        console.error('Error fetching direct conversation:', fetchError);
        return NextResponse.json({ error: 'Direct conversation created but failed to fetch details' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: conversation
      });
    }
  } catch (error) {
    console.error('Error in POST /api/conversations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    // Get all conversations for the current user using a simpler approach
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        id,
        conversation_type,
        name,
        created_by,
        created_at,
        updated_at
      `)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    // Filter conversations where the current user is a participant
    const userConversationIds = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (userConversationIds.error) {
      console.error('Error fetching user conversation IDs:', userConversationIds.error);
      return NextResponse.json({ error: 'Failed to fetch user conversations' }, { status: 500 });
    }

    const userConversationIdSet = new Set(userConversationIds.data?.map(cp => cp.conversation_id) || []);
    const userConversations = conversations?.filter(conv => userConversationIdSet.has(conv.id)) || [];

    console.log('All conversations:', conversations);
    console.log('User conversation IDs:', userConversationIds.data);
    console.log('Filtered user conversations:', userConversations);

    // Transform the data to make it easier to work with
    const transformedConversations = userConversations.map(conv => {
      console.log('Processing conversation:', conv);
      
      if (conv.conversation_type === 'direct') {
        // For direct conversations, we'll need to fetch the other user separately
        return {
          id: conv.id,
          type: 'direct',
          name: conv.name,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at
        };
      } else {
        // For group conversations
        return {
          id: conv.id,
          type: 'group',
          name: conv.name,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at
        };
      }
    });

    // Now fetch additional details for each conversation
    const enrichedConversations = await Promise.all(
      transformedConversations.map(async (conv) => {
        // Get participants for this conversation
        const { data: participants, error: participantsError } = await supabase
          .from('conversation_participants')
          .select(`
            user_id,
            users (
              id,
              username,
              full_name,
              avatar_url
            )
          `)
          .eq('conversation_id', conv.id);

        if (participantsError) {
          console.error('Error fetching participants for conversation', conv.id, ':', participantsError);
        }

        // Get the last message for this conversation
        const { data: lastMessage, error: messageError } = await supabase
          .from('messages')
          .select('id, content, sender_id, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (messageError && messageError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('Error fetching last message for conversation', conv.id, ':', messageError);
        }

        if (conv.type === 'direct') {
          // For direct conversations, find the other user
          const otherUser = participants?.find(p => p.user_id !== user.id)?.users;
          
          return {
            ...conv,
            otherUser: otherUser || null,
            lastMessage: lastMessage || null
          };
        } else {
          // For group conversations
          return {
            ...conv,
            participants: participants?.map(p => p.users) || [],
            lastMessage: lastMessage || null
          };
        }
      })
    );

    console.log('Final enriched conversations:', enrichedConversations);

    return NextResponse.json({
      success: true,
      data: enrichedConversations
    });

  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
