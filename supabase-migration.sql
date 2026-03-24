-- Migration: Add dual image support and scene dependency
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Add new columns for dual images and dependency
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS prompt_image2 text,
  ADD COLUMN IF NOT EXISTS image2_url text,
  ADD COLUMN IF NOT EXISTS depends_on text;

-- 2. Rename prompt_image → prompt_image1 (keep old name as alias for backwards compat)
-- We'll use prompt_image1 in new code, but keep prompt_image populated for old assets
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS prompt_image1 text;

-- Copy existing prompt_image data to prompt_image1
UPDATE assets SET prompt_image1 = prompt_image WHERE prompt_image1 IS NULL AND prompt_image IS NOT NULL;

-- 3. Rename image_url → image1_url
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS image1_url text;

-- Copy existing image_url data to image1_url
UPDATE assets SET image1_url = image_url WHERE image1_url IS NULL AND image_url IS NOT NULL;

-- 4. Add scenedescription column
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS scenedescription text;

-- Copy existing description to scenedescription for old assets
UPDATE assets SET scenedescription = description WHERE scenedescription IS NULL AND description IS NOT NULL;
