-- Optional customer photos attached to a review (URLs after S3 upload).
BEGIN;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.reviews.photos IS 'Array of image URLs uploaded with the review (JSON array of strings)';

COMMIT;
