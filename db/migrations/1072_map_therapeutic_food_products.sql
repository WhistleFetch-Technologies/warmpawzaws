-- Map parent Pet Food products to Therapeutic Food by name/description keywords.
-- Only updates rows still on parent Pet Food (does not override other subcategories).
-- Priority vs other subcats is enforced in application classifier; here we only tag
-- therapeutic matches on the parent bucket.

DO $$
DECLARE
  pet_food_id UUID;
  therapeutic_id UUID;
  therapeutic_pattern TEXT := '(therapeutic|prescription|renal|kidney|urinary|digestive|gastrointestinal|hypoallergenic|hydrolyzed|veterinary|clinical|recovery|hepatic|cardiac|vet diet|prescription diet)';
BEGIN
  SELECT id INTO pet_food_id FROM ecommerce_categories WHERE name = 'Pet Food' LIMIT 1;
  SELECT id INTO therapeutic_id FROM ecommerce_categories WHERE name = 'Therapeutic Food' LIMIT 1;

  IF pet_food_id IS NULL OR therapeutic_id IS NULL THEN
    RAISE NOTICE 'Pet Food or Therapeutic Food category missing — skipping therapeutic product remap';
    RETURN;
  END IF;

  UPDATE products p
  SET category_id = therapeutic_id,
      updated_at = NOW()
  WHERE p.category_id = pet_food_id
    AND LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) ~ therapeutic_pattern
    AND p.category_id IS DISTINCT FROM therapeutic_id;
END $$;
