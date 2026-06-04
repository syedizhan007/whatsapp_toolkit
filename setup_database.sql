-- ============================================
-- WhatsApp Toolkit - Supabase Database Setup
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

-- 3. Create business_config table
CREATE TABLE IF NOT EXISTS public.business_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    prompt_text TEXT NOT NULL DEFAULT 'You are a helpful WhatsApp business assistant.',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_row_check CHECK (id = 1)
);

-- Insert default business config
INSERT INTO public.business_config (id, prompt_text)
VALUES (1, 'You are a helpful WhatsApp business assistant. Respond in a friendly, professional manner.')
ON CONFLICT (id) DO NOTHING;

-- 4. Enable Row Level Security (RLS) - Optional but recommended
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_config ENABLE ROW LEVEL SECURITY;

-- 5. Create policies to allow public access (adjust based on your security needs)
-- For products table
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
CREATE POLICY "Allow public read access to business_config"
    ON public.business_config FOR SELECT
    USING (true);

CREATE POLICY "Allow public update access to business_config"
    ON public.business_config FOR UPDATE
    USING (true);

-- ============================================
-- Setup Complete!
-- ============================================
-- Next steps:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire script
-- 4. Click "Run" to execute
-- 5. Create a storage bucket named "product-images" (see instructions below)
-- ============================================
