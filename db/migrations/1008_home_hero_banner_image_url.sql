-- Ensure home hero CMS banners have image_url for customer carousel (mockup hero asset).
-- Safe to re-run: only fills empty image_url on active home_top/main banners.

UPDATE banners
SET image_url = '/images/home/hero-pet.webp',
    updated_at = NOW()
WHERE type IN ('main', 'home_top')
  AND is_active = true
  AND (image_url IS NULL OR TRIM(image_url) = '');
