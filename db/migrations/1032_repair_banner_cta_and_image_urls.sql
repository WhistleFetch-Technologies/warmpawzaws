-- Repair banner rows with broken default image paths and invalid placeholder CTA links.
-- Idempotent: safe to re-run on dev and prod.

-- 1) Clear non-existent default image path (customer shows gradient when empty)
UPDATE banners
SET image_url = NULL,
    updated_at = NOW()
WHERE image_url = '/images/home/hero-pet.webp';

-- 2) Rebuild cta_link from metadata.bannerTarget.vendorId where possible
UPDATE banners b
SET cta_link = '/' || LOWER(TRIM(COALESCE(
      b.metadata->'bannerTarget'->>'customerScreen',
      b.metadata->'bannerTarget'->>'persona',
      'vet'
    ))) || '/' || TRIM(v.business_name),
    updated_at = NOW()
FROM vendors v
WHERE b.cta_link ILIKE '%/placeholder%'
  AND NULLIF(TRIM(b.metadata->'bannerTarget'->>'vendorId'), '') IS NOT NULL
  AND (b.metadata->'bannerTarget'->>'vendorId')::uuid = v.id
  AND v.is_active = true
  AND v.status IN ('approved', 'active');

-- 3) Deactivate unrecoverable placeholder banners (no vendorId to rebuild)
UPDATE banners
SET cta_link = '',
    is_active = false,
    updated_at = NOW()
WHERE cta_link ILIKE '%/placeholder%';
