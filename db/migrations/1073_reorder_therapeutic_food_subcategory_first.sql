-- Show Therapeutic Food first among Pet Food subcategories (shop chip row + admin order).
DO $$
DECLARE
  parent_id UUID;
BEGIN
  SELECT id INTO parent_id FROM ecommerce_categories WHERE name = 'Pet Food' LIMIT 1;

  IF parent_id IS NULL THEN
    RAISE NOTICE 'Pet Food category missing — skipping therapeutic reorder';
    RETURN;
  END IF;

  UPDATE ecommerce_categories SET display_order = 12 WHERE name = 'Dry Pet Food';
  UPDATE ecommerce_categories SET display_order = 13 WHERE name = 'Wet Pet Food';
  UPDATE ecommerce_categories SET display_order = 14 WHERE name = 'Puppy Food';
  UPDATE ecommerce_categories SET display_order = 15 WHERE name = 'Adult Food';
  UPDATE ecommerce_categories SET display_order = 16 WHERE name = 'Pet Treats';
  UPDATE ecommerce_categories
  SET display_order = 11
  WHERE name = 'Therapeutic Food';
END $$;
