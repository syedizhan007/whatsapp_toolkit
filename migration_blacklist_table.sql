-- =====================================================
-- BLACKLIST TABLE MIGRATION
-- Multi-tenant blacklist for blocking phone numbers
-- =====================================================

-- Create blacklist table
CREATE TABLE IF NOT EXISTS public.blacklist (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    phone TEXT NOT NULL,
    reason TEXT DEFAULT 'Manually added',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique phone per user
    CONSTRAINT unique_user_phone UNIQUE (user_id, phone)
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_blacklist_user_id ON public.blacklist(user_id);

-- Create index on phone for fast searches
CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON public.blacklist(phone);

-- Enable Row Level Security (RLS)
ALTER TABLE public.blacklist ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own blacklist entries
CREATE POLICY "Users can view own blacklist"
    ON public.blacklist
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can only insert their own blacklist entries
CREATE POLICY "Users can insert own blacklist"
    ON public.blacklist
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own blacklist entries
CREATE POLICY "Users can delete own blacklist"
    ON public.blacklist
    FOR DELETE
    USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.blacklist TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE blacklist_id_seq TO authenticated;

-- Verification query (run this after migration to confirm)
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'blacklist'
-- ORDER BY ordinal_position;
