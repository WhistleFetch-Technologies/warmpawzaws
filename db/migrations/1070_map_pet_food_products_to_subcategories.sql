-- Re-tag products still on parent "Pet Food" into subcategories by name/description keywords.
-- Priority: Pet Treats → Wet → Dry → Puppy → Adult (same as pet-food-subcategory-classifier.ts).

DO $$
DECLARE
  pet_food_id UUID;
  dry_id UUID;
  wet_id UUID;
  puppy_id UUID;
  adult_id UUID;
  treats_id UUID;
BEGIN
  SELECT id INTO pet_food_id FROM ecommerce_categories WHERE name = 'Pet Food' LIMIT 1;
  SELECT id INTO dry_id FROM ecommerce_categories WHERE name = 'Dry Pet Food' LIMIT 1;
  SELECT id INTO wet_id FROM ecommerce_categories WHERE name = 'Wet Pet Food' LIMIT 1;
  SELECT id INTO puppy_id FROM ecommerce_categories WHERE name = 'Puppy Food' LIMIT 1;
  SELECT id INTO adult_id FROM ecommerce_categories WHERE name = 'Adult Food' LIMIT 1;
  SELECT id INTO treats_id FROM ecommerce_categories WHERE name = 'Pet Treats' LIMIT 1;

  IF pet_food_id IS NULL OR dry_id IS NULL OR wet_id IS NULL OR puppy_id IS NULL
     OR adult_id IS NULL OR treats_id IS NULL THEN
    RAISE NOTICE 'Pet Food subcategories not fully seeded — skipping product remap';
    RETURN;
  END IF;

  UPDATE products p
  SET category_id = mapped.new_category_id,
      updated_at = NOW()
  FROM (
    SELECT
      p2.id,
      CASE
        WHEN LOWER(COALESCE(p2.name, '') || ' ' || COALESCE(p2.description, ''))
          ~ '(treat|treats|chew|chews|munchies|munchy|bone|bones|snack|snacks|biscuit|biscuits|jerky|stick|sticks|kabab|kebab|tukada)'
          THEN treats_id
        WHEN LOWER(COALESCE(p2.name, '') || ' ' || COALESCE(p2.description, ''))
          ~ '(wet|gravy|chunks in gravy|in gravy|canned|pouch|pouches|moist|pate|pat[eé]|broth|stew)'
          THEN wet_id
        WHEN LOWER(COALESCE(p2.name, '') || ' ' || COALESCE(p2.description, ''))
          ~ '(dry|kibble|kibbles|pellets|crunchy)'
          THEN dry_id
        WHEN LOWER(COALESCE(p2.name, '') || ' ' || COALESCE(p2.description, ''))
          ~ '(puppy|puppies|kitten|kittens|junior)'
          THEN puppy_id
        WHEN LOWER(COALESCE(p2.name, '') || ' ' || COALESCE(p2.description, ''))
          ~ '(adult|senior|mature|7\+ years|1\+ year|1\+ years)'
          THEN adult_id
        ELSE NULL
      END AS new_category_id
    FROM products p2
    WHERE p2.category_id = pet_food_id
  ) mapped
  WHERE p.id = mapped.id
    AND mapped.new_category_id IS NOT NULL
    AND p.category_id IS DISTINCT FROM mapped.new_category_id;
END $$;
