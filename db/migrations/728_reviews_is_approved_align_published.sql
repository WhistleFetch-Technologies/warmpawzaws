-- Align is_approved with published customer reviews (same intent as POST /reviews/submit).
-- Fixes legacy/enhanced-created rows where is_approved defaulted false while is_published is true.

UPDATE public.reviews
SET is_approved = true,
    approved_at = COALESCE(approved_at, NOW())
WHERE is_approved IS NOT TRUE
  AND COALESCE(is_published, true) = true;
