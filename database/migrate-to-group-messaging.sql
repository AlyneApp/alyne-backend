-- Migration script to update from peer-to-peer to group-capable messaging
-- Run this after updating the messaging-schema.sql file

-- Step 1: Create new tables
-- (The new tables should already be created by the updated messaging-schema.sql)

-- Step 2: Migrate existing data from old conversations table to new structure
-- First, let's check if the old structure exists
DO $$
BEGIN
    -- Check if old columns exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' 
        AND column_name = 'user1_id'
    ) THEN
        -- Migrate existing direct conversations
        INSERT INTO conversation_participants (conversation_id, user_id)
        SELECT 
            id as conversation_id,
            user1_id as user_id
        FROM conversations 
        WHERE user1_id IS NOT NULL;
        
        INSERT INTO conversation_participants (conversation_id, user_id)
        SELECT 
            id as conversation_id,
            user2_id as user_id
        FROM conversations 
        WHERE user2_id IS NOT NULL;
        
        -- Update conversation_type to 'direct' for existing conversations
        UPDATE conversations 
        SET conversation_type = 'direct', 
            created_by = user1_id
        WHERE conversation_type IS NULL;
        
        -- Drop old columns
        ALTER TABLE conversations DROP COLUMN IF EXISTS user1_id;
        ALTER TABLE conversations DROP COLUMN IF EXISTS user2_id;
        
        RAISE NOTICE 'Migration completed successfully';
    ELSE
        RAISE NOTICE 'Old structure not found, migration not needed';
    END IF;
END $$;

-- Step 3: Update any existing foreign key constraints if needed
-- (This will be handled automatically by the new schema)

-- Step 4: Verify migration
SELECT 
    'conversations' as table_name,
    COUNT(*) as total_conversations,
    COUNT(CASE WHEN conversation_type = 'direct' THEN 1 END) as direct_conversations,
    COUNT(CASE WHEN conversation_type = 'group' THEN 1 END) as group_conversations
FROM conversations;

SELECT 
    'conversation_participants' as table_name,
    COUNT(*) as total_participants
FROM conversation_participants;

SELECT 
    'messages' as table_name,
    COUNT(*) as total_messages
FROM messages;
