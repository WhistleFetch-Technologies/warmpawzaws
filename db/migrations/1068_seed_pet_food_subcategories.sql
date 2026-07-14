-- Seed Pet Food subcategories (Dry / Wet / Puppy / Adult / Pet Treats).
-- Idempotent + additive: only inserts rows that don't already exist by name.
DO $$
DECLARE
  parent_id UUID;
  base_order INTEGER;
BEGIN
  SELECT id INTO parent_id FROM ecommerce_categories WHERE name = 'Pet Food' LIMIT 1;

  IF parent_id IS NOT NULL THEN
    SELECT COALESCE(MAX(display_order), 0) INTO base_order FROM ecommerce_categories;

    INSERT INTO ecommerce_categories (name, description, parent_category_id, display_order, is_active)
    SELECT v.name, v.description, parent_id, base_order + v.rn, true
    FROM (VALUES
      ('Dry Pet Food', 'Kibble and dry food for pets', 1),
      ('Wet Pet Food', 'Canned and wet/moist food for pets', 2),
      ('Puppy Food', 'Food formulated for puppies', 3),
      ('Adult Food', 'Food formulated for adult pets', 4),
      ('Pet Treats', 'Treats and snacks for pets', 5)
    ) AS v(name, description, rn)
    WHERE NOT EXISTS (
      SELECT 1 FROM ecommerce_categories ec WHERE ec.name = v.name
    );

    UPDATE ecommerce_categories ec
    SET parent_category_id = parent_id
    FROM (VALUES
      ('Dry Pet Food'),
      ('Wet Pet Food'),
      ('Puppy Food'),
      ('Adult Food'),
      ('Pet Treats')
    ) AS v(name)
    WHERE ec.name = v.name
      AND (ec.parent_category_id IS DISTINCT FROM parent_id);
  END IF;
END $$;
