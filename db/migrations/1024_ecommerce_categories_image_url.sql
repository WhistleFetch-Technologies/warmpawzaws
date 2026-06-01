-- Add admin-uploaded category image for customer shop grid (SS1)
ALTER TABLE ecommerce_categories
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN ecommerce_categories.image_url IS 'S3 or public URL for category tile image (admin-managed)';
