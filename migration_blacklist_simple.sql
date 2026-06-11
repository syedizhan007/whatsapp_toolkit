-- =====================================================
-- BLACKLIST TABLE - SIMPLE VERSION (No RLS)
-- Use this if the RLS version is blocking inserts
-- =====================================================

-- Drop existing table if any issues
DROP TABLE IF EXISTS public.blacklist CASCADE;

-- Create blacklist table
CREATE TABLE public.blacklist (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    phone TEXT NOT NULL,
    reason TEXT DEFAULT 'Manually added',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique phone per user
    CONSTRAINT unique_user_phone UNIQUE (user_id, phone)
);

-- Create indexes for performance
CREATE INDEX idx_blacklist_user_id ON public.blacklist(user_id);
CREATE INDEX idx_blacklist_phone ON public.blacklist(phone);

-- DISABLE RLS for now (easier for testing)
ALTER TABLE public.blacklist DISABLE ROW LEVEL SECURITY;

-- Grant full access to authenticated users
GRANT ALL ON public.blacklist TO authenticated;
GRANT ALL ON public.blacklist TO anon;
GRANT USAGE, SELECT ON SEQUENCE blacklist_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE blacklist_id_seq TO anon;

-- Test query
SELECT 'Blacklist table created successfully!' as status;
