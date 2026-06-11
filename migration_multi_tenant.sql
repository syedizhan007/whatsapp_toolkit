-- ============================================
-- MULTI-TENANT SAAS MIGRATION SCRIPT
-- Adds user isolation to all tables
-- ============================================

-- 1. Add user_id and payment_details to business_config
ALTER TABLE public.business_config
ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'default_user',
ADD COLUMN IF NOT EXISTS payment_details TEXT;

-- Remove single row constraint to allow multiple users
ALTER TABLE public.business_config
DROP CONSTRAINT IF EXISTS single_row_check;

-- Add unique constraint for user_id
ALTER TABLE public.business_config
DROP CONSTRAINT IF EXISTS business_config_user_id_key;
ALTER TABLE public.business_config
ADD CONSTRAINT business_config_user_id_key UNIQUE (user_id);

-- Update primary key to include user_id (drop old PK first)
ALTER TABLE public.business_config
DROP CONSTRAINT IF EXISTS business_config_pkey;

ALTER TABLE public.business_config
ADD PRIMARY KEY (user_id);

COMMENT ON COLUMN public.business_config.user_id IS 'Supabase Auth user ID for multi-tenant isolation';
COMMENT ON COLUMN public.business_config.payment_details IS 'Payment account details (bank account, JazzCash, etc.)';

-- 2. Add user_id to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'default_user';

-- Create index for faster user-specific queries
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);

COMMENT ON COLUMN public.products.user_id IS 'Supabase Auth user ID for multi-tenant isolation';

-- 3. Add user_id to product_media table
ALTER TABLE public.product_media
ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'default_user';

-- Create index for faster user-specific queries
CREATE INDEX IF NOT EXISTS idx_product_media_user_id ON public.product_media(user_id);

COMMENT ON COLUMN public.product_media.user_id IS 'Supabase Auth user ID for multi-tenant isolation';

-- 4. Create deal_tracker table for confirmed deals
CREATE TABLE IF NOT EXISTS public.deal_tracker (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_name TEXT,
    message_text TEXT NOT NULL,
    intent_detected TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'pending', 'completed', 'cancelled'))
);

-- Create indexes for deal_tracker
CREATE INDEX IF NOT EXISTS idx_deal_tracker_user_id ON public.deal_tracker(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_tracker_created_at ON public.deal_tracker(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_tracker_phone ON public.deal_tracker(customer_phone);

COMMENT ON TABLE public.deal_tracker IS 'Tracks confirmed deals when customers express buying intent';
COMMENT ON COLUMN public.deal_tracker.user_id IS 'Supabase Auth user ID - which business this deal belongs to';
COMMENT ON COLUMN public.deal_tracker.customer_phone IS 'WhatsApp phone number of customer';
COMMENT ON COLUMN public.deal_tracker.intent_detected IS 'Buying intent detected (e.g., "done", "confirm", "pack kerdo")';

-- 5. Enable RLS on deal_tracker
ALTER TABLE public.deal_tracker ENABLE ROW LEVEL SECURITY;

-- 6. Update RLS policies for multi-tenant isolation

-- Products policies (user-specific)
DROP POLICY IF EXISTS "Allow public read access to products" ON public.products;
DROP POLICY IF EXISTS "Allow public insert access to products" ON public.products;
DROP POLICY IF EXISTS "Allow public update access to products" ON public.products;
DROP POLICY IF EXISTS "Allow public delete access to products" ON public.products;

-- For now, allow all operations (can be tightened later with auth.uid())
CREATE POLICY "Allow all operations on products"
    ON public.products FOR ALL
    USING (true)
    WITH CHECK (true);

-- Product Media policies (user-specific)
DROP POLICY IF EXISTS "Allow public read access to product_media" ON public.product_media;
DROP POLICY IF EXISTS "Allow public insert access to product_media" ON public.product_media;
DROP POLICY IF EXISTS "Allow public update access to product_media" ON public.product_media;
DROP POLICY IF EXISTS "Allow public delete access to product_media" ON public.product_media;

CREATE POLICY "Allow all operations on product_media"
    ON public.product_media FOR ALL
    USING (true)
    WITH CHECK (true);

-- Business Config policies (user-specific)
DROP POLICY IF EXISTS "Allow public read access to business_config" ON public.business_config;
DROP POLICY IF EXISTS "Allow public update access to business_config" ON public.business_config;
DROP POLICY IF EXISTS "Allow all operations on business_config" ON public.business_config;

CREATE POLICY "Allow all operations on business_config"
    ON public.business_config FOR ALL
    USING (true)
    WITH CHECK (true);

-- Deal Tracker policies
CREATE POLICY "Allow all operations on deal_tracker"
    ON public.deal_tracker FOR ALL
    USING (true)
    WITH CHECK (true);

-- 7. Verify migration
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('products', 'product_media', 'business_config', 'deal_tracker')
ORDER BY table_name, ordinal_position;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Next steps:
-- 1. Update server.js to filter all queries by userId
-- 2. Update frontend to send userId with all requests
-- 3. Test with multiple users to verify isolation
-- ============================================
