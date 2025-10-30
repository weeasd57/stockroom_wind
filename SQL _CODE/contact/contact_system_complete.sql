-- ============================================================================
-- Contact System - Complete SQL Setup
-- ============================================================================
-- This file contains everything needed to set up the contact system:
-- - Tables (conversations, messages)
-- - Indexes for performance
-- - Triggers for auto-updates
-- - RLS (Row Level Security) policies
-- - Helper functions
-- - Migration queries for existing data
--
-- Run this entire file in Supabase SQL Editor to set up the system.
-- Safe to run multiple times (uses IF EXISTS checks).
-- ============================================================================

-- ============================================================================
-- SECTION 1: CLEANUP (Optional - uncomment to reset)
-- ============================================================================
-- Uncomment the following lines to completely reset the contact system:

-- DROP TABLE IF EXISTS contact_messages CASCADE;
-- DROP TABLE IF EXISTS contact_conversations CASCADE;
-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
-- DROP FUNCTION IF EXISTS bump_last_message_at() CASCADE;
-- DROP FUNCTION IF EXISTS get_conversation_messages(UUID) CASCADE;

-- ============================================================================
-- SECTION 2: TABLES
-- ============================================================================

-- Contact Conversations Table
CREATE TABLE IF NOT EXISTS contact_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  telegram_user_id BIGINT,
  telegram_username VARCHAR(255),
  status VARCHAR(10) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact Messages Table
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES contact_conversations(id) ON DELETE CASCADE,
  sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'admin')),
  body TEXT NOT NULL,
  reply_to UUID REFERENCES contact_messages(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 3: INDEXES (Performance)
-- ============================================================================

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id 
  ON contact_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_email 
  ON contact_conversations(email);

CREATE INDEX IF NOT EXISTS idx_conversations_status 
  ON contact_conversations(status);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message 
  ON contact_conversations(last_message_at DESC);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id 
  ON contact_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_messages_created_at 
  ON contact_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_messages_sender 
  ON contact_messages(sender);

-- ============================================================================
-- SECTION 4: TRIGGERS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at on conversations
DROP TRIGGER IF EXISTS trg_update_conversations_updated_at ON contact_conversations;
CREATE TRIGGER trg_update_conversations_updated_at
BEFORE UPDATE ON contact_conversations
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function: Update last_message_at when message is inserted
CREATE OR REPLACE FUNCTION bump_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contact_conversations
  SET last_message_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update last_message_at when new message
DROP TRIGGER IF EXISTS trg_bump_last_message_at ON contact_messages;
CREATE TRIGGER trg_bump_last_message_at
AFTER INSERT ON contact_messages
FOR EACH ROW EXECUTE PROCEDURE bump_last_message_at();

-- ============================================================================
-- SECTION 5: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE contact_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 6: RLS POLICIES - CONVERSATIONS
-- ============================================================================

-- DROP existing policies first
DROP POLICY IF EXISTS contact_conversations_select_own ON contact_conversations;
DROP POLICY IF EXISTS contact_conversations_insert_own ON contact_conversations;
DROP POLICY IF EXISTS contact_conversations_update_own ON contact_conversations;
DROP POLICY IF EXISTS contact_conversations_service_role_all ON contact_conversations;

-- SELECT: Allow users to see their own conversations OR orphan conversations with matching email
CREATE POLICY contact_conversations_select_own ON contact_conversations
FOR SELECT USING (
  user_id = auth.uid() OR 
  (user_id IS NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- INSERT: Allow authenticated users OR public (null user_id) to create conversations
CREATE POLICY contact_conversations_insert_own ON contact_conversations
FOR INSERT WITH CHECK (
  user_id = auth.uid() OR 
  user_id IS NULL
);

-- UPDATE: Allow users to update their own conversations OR orphan conversations with matching email
CREATE POLICY contact_conversations_update_own ON contact_conversations
FOR UPDATE USING (
  user_id = auth.uid() OR 
  (user_id IS NULL AND email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

-- SERVICE ROLE: Allow service role (API with admin client) full access
CREATE POLICY contact_conversations_service_role_all ON contact_conversations
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ============================================================================
-- SECTION 7: RLS POLICIES - MESSAGES
-- ============================================================================

-- DROP existing policies first
DROP POLICY IF EXISTS contact_messages_select_own ON contact_messages;
DROP POLICY IF EXISTS contact_messages_insert_own ON contact_messages;
DROP POLICY IF EXISTS contact_messages_service_role_all ON contact_messages;

-- SELECT: Allow users to see messages in their own conversations
CREATE POLICY contact_messages_select_own ON contact_messages
FOR SELECT USING (
  EXISTS(
    SELECT 1 FROM contact_conversations c
    WHERE c.id = contact_messages.conversation_id 
    AND (
      c.user_id = auth.uid() OR
      (c.user_id IS NULL AND c.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  )
);

-- INSERT: Allow users to insert messages in their own conversations
CREATE POLICY contact_messages_insert_own ON contact_messages
FOR INSERT WITH CHECK (
  sender = 'user' AND EXISTS(
    SELECT 1 FROM contact_conversations c
    WHERE c.id = contact_messages.conversation_id 
    AND (
      c.user_id = auth.uid() OR
      (c.user_id IS NULL AND c.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  )
);

-- SERVICE ROLE: Allow service role (API with admin client) full access
CREATE POLICY contact_messages_service_role_all ON contact_messages
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ============================================================================
-- SECTION 8: HELPER FUNCTIONS
-- ============================================================================

-- Function: Get conversation messages (bypasses RLS when called with service role)
CREATE OR REPLACE FUNCTION get_conversation_messages(conv_id UUID)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  sender VARCHAR(10),
  body TEXT,
  reply_to UUID,
  admin_id UUID,
  created_at TIMESTAMPTZ
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.id,
    cm.conversation_id,
    cm.sender,
    cm.body,
    cm.reply_to,
    cm.admin_id,
    cm.created_at
  FROM contact_messages cm
  WHERE cm.conversation_id = conv_id
  ORDER BY cm.created_at ASC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_conversation_messages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_messages(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_conversation_messages(UUID) TO anon;

-- ============================================================================
-- SECTION 9: DATA MIGRATION (Optional)
-- ============================================================================

-- Link orphan conversations (user_id IS NULL) to their respective users by email
-- Run this if you have existing conversations that need to be linked to users

-- Preview orphan conversations that will be linked:
-- SELECT 
--   cc.id,
--   cc.email,
--   cc.name,
--   cc.user_id as current_user_id,
--   au.id as matched_user_id,
--   au.email as matched_email
-- FROM contact_conversations cc
-- LEFT JOIN auth.users au ON au.email = cc.email
-- WHERE cc.user_id IS NULL
-- ORDER BY cc.created_at DESC;

-- Uncomment to execute the migration:
-- UPDATE contact_conversations cc
-- SET user_id = au.id
-- FROM auth.users au
-- WHERE cc.user_id IS NULL
--   AND cc.email = au.email;

-- ============================================================================
-- SECTION 10: VERIFICATION QUERIES
-- ============================================================================

-- Verify tables were created
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('contact_conversations', 'contact_messages')
ORDER BY table_name;

-- Verify indexes were created
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('contact_conversations', 'contact_messages')
ORDER BY tablename, indexname;

-- Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('contact_conversations', 'contact_messages');

-- Verify RLS policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command
FROM pg_policies
WHERE tablename IN ('contact_conversations', 'contact_messages')
ORDER BY tablename, policyname;

-- Verify triggers were created
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('contact_conversations', 'contact_messages')
ORDER BY event_object_table, trigger_name;

-- Verify functions were created
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('update_updated_at_column', 'bump_last_message_at', 'get_conversation_messages')
ORDER BY routine_name;

-- ============================================================================
-- SECTION 11: SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Uncomment to insert sample data for testing:

-- INSERT INTO contact_conversations (email, name, subject, status)
-- VALUES 
--   ('test1@example.com', 'Test User 1', 'Test Subject 1', 'open'),
--   ('test2@example.com', 'Test User 2', 'Test Subject 2', 'open')
-- RETURNING id, email, name;

-- Get the conversation IDs from above and insert sample messages:
-- INSERT INTO contact_messages (conversation_id, sender, body)
-- VALUES 
--   ('conversation-id-here', 'user', 'This is a test message'),
--   ('conversation-id-here', 'admin', 'This is a test reply');

-- ============================================================================
-- SECTION 12: CLEANUP OLD DATA (Use with caution!)
-- ============================================================================

-- Delete all conversations and messages (CAREFUL - THIS DELETES EVERYTHING!)
-- Uncomment only if you want to completely reset your data:

-- DELETE FROM contact_messages;
-- DELETE FROM contact_conversations;

-- Reset sequences (if needed):
-- This is not needed for UUID-based tables

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN 
  RAISE NOTICE '✅ Contact System setup completed successfully!';
  RAISE NOTICE '📊 Tables: contact_conversations, contact_messages';
  RAISE NOTICE '🔐 RLS: Enabled with proper policies';
  RAISE NOTICE '⚡ Triggers: Auto-update timestamps';
  RAISE NOTICE '🔍 Indexes: Optimized for performance';
  RAISE NOTICE '🎯 Ready to use!';
END $$;

-- ============================================================================
-- END OF FILE
-- ============================================================================
