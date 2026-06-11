-- =====================================================
-- CAMPAIGN LOGS TABLE MIGRATION
-- Tracks individual contact status for each campaign
-- =====================================================

-- Create campaign_logs table
CREATE TABLE IF NOT EXISTS public.campaign_logs (
    id BIGSERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL,
    user_id UUID NOT NULL,
    contact_name TEXT,
    contact_phone TEXT NOT NULL,
    contact_phone_normalized TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    error_reason TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign_id ON public.campaign_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_user_id ON public.campaign_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_status ON public.campaign_logs(status);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_phone ON public.campaign_logs(contact_phone_normalized);

-- Enable Row Level Security (RLS)
ALTER TABLE public.campaign_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own campaign logs
CREATE POLICY "Users can view own campaign logs"
    ON public.campaign_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can only insert their own campaign logs
CREATE POLICY "Users can insert own campaign logs"
    ON public.campaign_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.campaign_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE campaign_logs_id_seq TO authenticated;

-- Verification query
SELECT
    'Campaign logs table created successfully!' as status,
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'campaign_logs'
ORDER BY ordinal_position;

-- Example queries to use after campaigns run:

-- Get all contacts from a campaign with their status
-- SELECT contact_name, contact_phone, status, error_reason, attempted_at
-- FROM campaign_logs
-- WHERE campaign_id = 1
-- ORDER BY attempted_at;

-- Get failed contacts with reasons
-- SELECT contact_name, contact_phone, error_reason
-- FROM campaign_logs
-- WHERE campaign_id = 1 AND status = 'failed'
-- ORDER BY attempted_at;

-- Get blacklisted contacts from all campaigns
-- SELECT campaign_id, contact_name, contact_phone, attempted_at
-- FROM campaign_logs
-- WHERE status = 'failed' AND error_reason = 'Blacklisted Number'
-- ORDER BY attempted_at DESC;

-- Campaign success rate
-- SELECT
--     campaign_id,
--     COUNT(*) as total,
--     SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
--     SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
--     ROUND(100.0 * SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
-- FROM campaign_logs
-- GROUP BY campaign_id;
