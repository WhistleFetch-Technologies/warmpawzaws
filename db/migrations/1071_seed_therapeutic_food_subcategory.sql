-- Seed Therapeutic Food under Pet Food (idempotent).
DO $$
DECLARE
  parent_id UUID;
  base_order INTEGER;
BEGIN
  SELECT id INTO parent_id FROM ecommerce_categories WHERE name = 'Pet Food' LIMIT 1;

  IF parent_id IS NOT NULL THEN
    SELECT COALESCE(MAX(display_order), 0) INTO base_order FROM ecommerce_categories;

    INSERT INTO ecommerce_categories (name, description, parent_category_id, display_order, is_active)
    SELECT
      'Therapeutic Food',
      'Prescription and veterinary diet food for pets',
      parent_id,
      base_order + 1,
      true
    WHERE NOT EXISTS (
      SELECT 1 FROM ecommerce_categories WHERE name = 'Therapeutic Food'
    );

    UPDATE ecommerce_categories
    SET parent_category_id = parent_id,
        description = COALESCE(NULLIF(TRIM(description), ''), 'Prescription and veterinary diet food for pets'),
        display_order = 11
    WHERE name = 'Therapeutic Food'
      AND (
        parent_category_id IS DISTINCT FROM parent_id
        OR display_order IS DISTINCT FROM 11
      );
  END IF;
END $$;
