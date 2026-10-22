-- Dedicated Insurance catalogue category and a 0% GST tax card.
-- Insurance tele consultation stays on this category. It is not mapped to Vet Care.

INSERT INTO service_categories (category_id, name, description, display_order, is_active)
VALUES (
  'insurance',
  'Insurance',
  'Pet insurance consultation',
  20,
  true
)
ON CONFLICT (category_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = NOW();

DO $$
DECLARE
  catalog_id UUID;
  uses_name BOOLEAN;
  uses_default_rate BOOLEAN;
BEGIN
  SELECT id INTO catalog_id FROM service_categories WHERE category_id = 'insurance' LIMIT 1;
  IF catalog_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_categories' AND column_name = 'name'
  ) INTO uses_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_categories' AND column_name = 'default_gst_rate'
  ) INTO uses_default_rate;

  IF NOT EXISTS (
    SELECT 1 FROM tax_categories
    WHERE catalog_category_id = catalog_id
      AND COALESCE(gst_application_scope, 'service_booking') = 'service_booking'
      AND is_active = true
  ) THEN
    IF uses_name AND uses_default_rate THEN
      INSERT INTO tax_categories (
        name, category_name, description, default_gst_rate, tax_rate,
        is_active, catalog_category_id, gst_application_scope
      ) VALUES (
        'Insurance', 'Insurance',
        'Pet insurance tele consultation. GST 0%. Admin can update this rate.',
        0, 0, TRUE, catalog_id, 'service_booking'
      );
    ELSIF uses_name THEN
      INSERT INTO tax_categories (
        name, description, tax_rate, is_active, catalog_category_id, gst_application_scope
      ) VALUES (
        'Insurance',
        'Pet insurance tele consultation. GST 0%. Admin can update this rate.',
        0, TRUE, catalog_id, 'service_booking'
      );
    ELSE
      INSERT INTO tax_categories (
        category_name, description, tax_rate, is_active, catalog_category_id, gst_application_scope
      ) VALUES (
        'Insurance',
        'Pet insurance tele consultation. GST 0%. Admin can update this rate.',
        0, TRUE, catalog_id, 'service_booking'
      );
    END IF;
  END IF;

  IF uses_default_rate THEN
    UPDATE tax_categories
    SET tax_rate = 0,
        default_gst_rate = 0,
        is_active = true,
        gst_application_scope = 'service_booking',
        description = 'Pet insurance tele consultation. GST 0%. Admin can update this rate.'
    WHERE catalog_category_id = catalog_id
      AND COALESCE(gst_application_scope, 'service_booking') = 'service_booking';
  ELSE
    UPDATE tax_categories
    SET tax_rate = 0,
        is_active = true,
        gst_application_scope = 'service_booking',
        description = 'Pet insurance tele consultation. GST 0%. Admin can update this rate.'
    WHERE catalog_category_id = catalog_id
      AND COALESCE(gst_application_scope, 'service_booking') = 'service_booking';
  END IF;
END $$;

UPDATE service_catalog
SET category_id = 'insurance',
    category_name = 'Insurance',
    updated_at = NOW()
WHERE service_id = 'insurance_tele_consultation'
  AND (category_id IS DISTINCT FROM 'insurance' OR category_name IS DISTINCT FROM 'Insurance');

UPDATE vendor_services vs
SET category = 'insurance',
    updated_at = NOW()
FROM service_catalog sc
WHERE vs.service_id = sc.id
  AND sc.service_id = 'insurance_tele_consultation'
  AND vs.category IS DISTINCT FROM 'insurance';
