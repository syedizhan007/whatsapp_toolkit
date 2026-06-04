-- ============================================
-- Add AI Agent Status Column to business_config
-- ============================================

-- Add is_active column to business_config table
ALTER TABLE public.business_config
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Set default value for existing row
UPDATE public.business_config
SET is_active = false
WHERE id = 1 AND is_active IS NULL;

-- ============================================
-- Instructions:
-- 1. Go to Supabase SQL Editor
-- 2. Copy and paste this script
-- 3. Click "Run" to execute
-- ============================================
