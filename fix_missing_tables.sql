-- ============================================
-- Fix Missing Tables - Run this in Supabase SQL Editor
-- ============================================

-- 1. Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id BIGSERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    price_pkr NUMERIC(10, 2) NOT NULL CHECK (price_pkr > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 3. Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for products table
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

-- 5. Create policies for product_media table
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

-- ============================================
-- After running this script:
-- 1. Go to "Table Editor" in Supabase
-- 2. Verify you see "products" and "product_media" tables
-- 3. Come back and type "done" again
-- ============================================
