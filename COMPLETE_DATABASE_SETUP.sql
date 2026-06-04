-- ============================================
-- WhatsApp Toolkit - COMPLETE Database Setup
-- This script includes ALL tables and columns
-- ============================================

-- 1. Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id BIGSERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    price_pkr NUMERIC(10, 2) NOT NULL CHECK (price_pkr > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

-- 2. Create product_media table
CREATE TABLE IF NOT EXISTS public.product_media (
    id BIGSERIAL PRIMARY KEY,
    product_tag TEXT NOT NULL,
    image_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_product_media_tag ON public.product_media(product_tag);
CREATE INDEX IF NOT EXISTS idx_product_media_created_at ON public.product_media(created_at DESC);

-- 3. Create business_config table WITH is_active column
CREATE TABLE IF NOT EXISTS public.business_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    prompt_text TEXT NOT NULL DEFAULT 'You are a helpful WhatsApp business assistant.',
    is_active BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_row_check CHECK (id = 1)
);

-- Insert default business config
INSERT INTO public.business_config (id, prompt_text, is_active)
VALUES (
    1,
    'You are a professional Pakistani salesman selling Bedsheets, Shirts, and Pillows.

CRITICAL RULES - FOLLOW EXACTLY:

1. IDENTITY: You are a professional salesman. Your name is Ali. You sell bedsheets, shirts, and pillows.

2. FIXED PRICE LIST (NON-NEGOTIABLE):
   - Bedsheet: 1500 PKR (exact price, never change)
   - Shirt: 300 PKR (exact price, never change)
   - Pillow: 200 PKR (exact price, never change)

3. LANGUAGE RULE (STRICTLY ENFORCE):
   - Use 100% Roman Urdu ONLY in ALL responses
   - NEVER use English sentences
   - NEVER use the "₹" symbol (Indian Rupee symbol)
   - ALWAYS use "PKR" or "Rupay" for currency

4. PRICING STRICTNESS:
   - When asked about price, give EXACT numbers from the price list above
   - NEVER give price ranges

5. TOPIC BOUNDARIES:
   - ONLY discuss bedsheets, shirts, pillows, prices, orders, and delivery
   - Do NOT answer questions about politics, weather, news, or general knowledge

6. RESPONSE FORMAT:
   - Keep responses short (2-3 sentences maximum)
   - Be friendly and professional
   - Use natural Roman Urdu conversation style',
    false
)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_config ENABLE ROW LEVEL SECURITY;

-- 5. Create policies to allow public access
-- For products table
DROP POLICY IF EXISTS "Allow public read access to products" ON public.products;
DROP POLICY IF EXISTS "Allow public insert access to products" ON public.products;
DROP POLICY IF EXISTS "Allow public update access to products" ON public.products;
DROP POLICY IF EXISTS "Allow public delete access to products" ON public.products;

CREATE POLICY "Allow public read access to products"
    ON public.products FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert access to products"
    ON public.products FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update access to products"
    ON public.products FOR UPDATE
    USING (true);

CREATE POLICY "Allow public delete access to products"
    ON public.products FOR DELETE
    USING (true);

-- For product_media table
DROP POLICY IF EXISTS "Allow public read access to product_media" ON public.product_media;
DROP POLICY IF EXISTS "Allow public insert access to product_media" ON public.product_media;
DROP POLICY IF EXISTS "Allow public update access to product_media" ON public.product_media;
DROP POLICY IF EXISTS "Allow public delete access to product_media" ON public.product_media;

CREATE POLICY "Allow public read access to product_media"
    ON public.product_media FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert access to product_media"
    ON public.product_media FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update access to product_media"
    ON public.product_media FOR UPDATE
    USING (true);

CREATE POLICY "Allow public delete access to product_media"
    ON public.product_media FOR DELETE
    USING (true);

-- For business_config table
DROP POLICY IF EXISTS "Allow public read access to business_config" ON public.business_config;
DROP POLICY IF EXISTS "Allow public update access to business_config" ON public.business_config;
DROP POLICY IF EXISTS "Allow all operations on business_config" ON public.business_config;

CREATE POLICY "Allow public read access to business_config"
    ON public.business_config FOR SELECT
    USING (true);

CREATE POLICY "Allow public update access to business_config"
    ON public.business_config FOR UPDATE
    USING (true);

-- ============================================
-- IF YOU ALREADY HAVE THE DATABASE SET UP:
-- Run this to add the missing is_active column
-- ============================================

-- Add is_active column if it doesn't exist
ALTER TABLE public.business_config
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Set default value for existing row
UPDATE public.business_config
SET is_active = false
WHERE id = 1 AND is_active IS NULL;

-- ============================================
-- Verify Setup
-- ============================================
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('products', 'product_media', 'business_config')
ORDER BY table_name, ordinal_position;

-- ============================================
-- Setup Complete!
-- ============================================
-- Instructions:
-- 1. Go to: https://supabase.com/dashboard/project/xrphyjkrzolqyowkkvzf/editor
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Copy and paste this entire script
-- 5. Click "Run" to execute
-- 6. Check the results to verify all tables and columns exist
-- ============================================
