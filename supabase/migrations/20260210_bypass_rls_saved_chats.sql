-- =====================================================
-- BYPASS RLS FOR legalrnd_saved_chats
-- =====================================================
-- Purpose: Unblock development by allowing public access to saved chats.
-- WARNING: This disables security for this table. Re-enable before production.
-- =====================================================

-- 1. Drop existing strict policies
DROP POLICY IF EXISTS "Lawyers view own chats" ON legalrnd_saved_chats;
DROP POLICY IF EXISTS "Lawyers insert own chats" ON legalrnd_saved_chats;
DROP POLICY IF EXISTS "Lawyers update own chats" ON legalrnd_saved_chats;
DROP POLICY IF EXISTS "Lawyers delete own chats" ON legalrnd_saved_chats;

-- 2. Create permissive policy (Public Access)
CREATE POLICY "Public full access to saved chats" ON legalrnd_saved_chats
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Verify RLS is still enabled (policies only work if RLS is on)
ALTER TABLE legalrnd_saved_chats ENABLE ROW LEVEL SECURITY;
