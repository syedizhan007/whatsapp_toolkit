-- Product Media Table Schema for WhatsApp Toolkit
-- This table stores product photos with tags for the AI Agent

CREATE TABLE IF NOT EXISTS product_media (
    id BIGSERIAL PRIMARY KEY,
    product_tag TEXT NOT NULL,
    image_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster tag-based queries
CREATE INDEX idx_product_media_tag ON product_media(product_tag);
CREATE INDEX idx_product_media_created ON product_media(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth requirements)
CREATE POLICY "Allow all operations on product_media" ON product_media
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- SUPABASE STORAGE BUCKET SETUP
-- ============================================
-- Run these commands in Supabase Dashboard > Storage

-- 1. Create a new bucket called 'product-images'
-- 2. Set it to PUBLIC (so images can be accessed via URL)
-- 3. Configure file size limit (e.g., 5MB max)
-- 4. Allowed MIME types: image/jpeg, image/png, image/webp

-- To create bucket via SQL (if needed):
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy to allow public uploads
CREATE POLICY "Allow public uploads to product-images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'product-images');

-- Create storage policy to allow public reads
CREATE POLICY "Allow public reads from product-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Create storage policy to allow public deletes
CREATE POLICY "Allow public deletes from product-images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'product-images');

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================
-- Uncomment to insert sample media entries
-- Note: You'll need to upload actual images first

-- INSERT INTO product_media (product_tag, image_url, file_name, file_size, mime_type) VALUES
--     ('Bedsheet', 'https://xrphyjkrzolqyowkkvzf.supabase.co/storage/v1/object/public/product-images/bedsheet1.jpg', 'bedsheet1.jpg', 245678, 'image/jpeg'),
--     ('Shirt', 'https://xrphyjkrzolqyowkkvzf.supabase.co/storage/v1/object/public/product-images/shirt1.jpg', 'shirt1.jpg', 189234, 'image/jpeg');
