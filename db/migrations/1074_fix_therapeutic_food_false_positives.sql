-- Fix therapeutic keyword false positives (e.g. cat litter descriptions mentioning "veterinary").
-- Re-tag litter products still on Therapeutic Food back to parent Pet Food when name says litter.

DO $$
DECLARE
  pet_food_id UUID;
  therapeutic_id UUID;
BEGIN
  SELECT id INTO pet_food_id FROM ecommerce_categories WHERE name = 'Pet Food' LIMIT 1;
  SELECT id INTO therapeutic_id FROM ecommerce_categories WHERE name = 'Therapeutic Food' LIMIT 1;

  IF pet_food_id IS NULL OR therapeutic_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE products p
  SET category_id = pet_food_id,
      updated_at = NOW()
  WHERE p.category_id = therapeutic_id
    AND LOWER(COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) ~ '(cat litter|litter tray|litter box|litter mat)';
END $$;
