-- Deactivate seeded home hero promos removed from product (grooming 50% + premium pet food carousel).
-- Safe to re-run: only touches rows matching exact legacy titles used in seeds / admin defaults.

UPDATE banners
SET is_active = false,
    updated_at = NOW()
WHERE is_active = true
  AND type IN ('main', 'home_top', 'home_middle')
  AND title IN ('Get 50% OFF', 'Premium Pet Food');
