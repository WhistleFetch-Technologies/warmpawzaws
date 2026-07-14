-- Ensure ecommerce_categories.parent_category_id exists and link Pet Food subcategories.
-- Some dev/prod DBs were created without this column; admin API silently dropped parent on insert.

ALTER TABLE ecommerce_categories
  ADD COLUMN IF NOT EXISTS parent_category_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ecommerce_categories_parent_fkey'
  ) THEN
    ALTER TABLE ecommerce_categories
      ADD CONSTRAINT ecommerce_categories_parent_fkey
      FOREIGN KEY (parent_category_id) REFERENCES ecommerce_categories(id);
  END IF;
END $$;

-- Backfill parent for Pet Food subcategories (inserted without parent when column was missing).
DO $$
DECLARE
  parent_id UUID;
BEGIN
  SELECT id INTO parent_id FROM ecommerce_categories WHERE name = 'Pet Food' LIMIT 1;

  IF parent_id IS NOT NULL THEN
    UPDATE ecommerce_categories
    SET parent_category_id = parent_id
    WHERE name IN (
      'Dry Pet Food',
      'Wet Pet Food',
      'Puppy Food',
      'Adult Food',
      'Pet Treats'
    )
      AND (parent_category_id IS DISTINCT FROM parent_id);
  END IF;
END $$;
