-- Fix existing conversations by adding the creator as a participant
-- This script adds the current user (eacd6757-b29d-417e-be17-9e58f27d9f9f) to all conversations they created

-- First, let's see what conversations exist and who created them
SELECT id, conversation_type, name, created_by, created_at 
FROM conversations 
ORDER BY created_at DESC;

-- Now let's see what participants exist for each conversation
SELECT 
  c.id as conversation_id,
  c.conversation_type,
  c.name,
  c.created_by,
  cp.user_id as participant_user_id,
  u.username as participant_username
FROM conversations c
LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
LEFT JOIN users u ON cp.user_id = u.id
ORDER BY c.created_at DESC;

-- Add the creator as a participant to all conversations where they're not already a participant
INSERT INTO conversation_participants (conversation_id, user_id)
SELECT 
  c.id as conversation_id,
  c.created_by as user_id
FROM conversations c
WHERE NOT EXISTS (
  SELECT 1 
  FROM conversation_participants cp 
  WHERE cp.conversation_id = c.id 
  AND cp.user_id = c.created_by
)
AND c.created_by = 'eacd6757-b29d-417e-be17-9e58f27d9f9f';

-- Verify the fix by checking participants again
SELECT 
  c.id as conversation_id,
  c.conversation_type,
  c.name,
  c.created_by,
  cp.user_id as participant_user_id,
  u.username as participant_username
FROM conversations c
LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
LEFT JOIN users u ON cp.user_id = u.id
ORDER BY c.created_at DESC;
