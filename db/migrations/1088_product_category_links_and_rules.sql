-- Generic product ↔ subcategory membership + admin keyword rules.
-- Normalizes Pet Food products to parent category_id and multi-match AUTO links.

CREATE TABLE IF NOT EXISTS product_category_links (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  subcategory_id UUID NOT NULL REFERENCES ecommerce_categories(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'AUTO'
    CHECK (source IN ('AUTO', 'ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, subcategory_id)
);

CREATE INDEX IF NOT EXISTS idx_product_category_links_subcategory
  ON product_category_links (subcategory_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_category_links_product
  ON product_category_links (product_id);

CREATE TABLE IF NOT EXISTS ecommerce_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id UUID NOT NULL REFERENCES ecommerce_categories(id) ON DELETE CASCADE,
  include_keywords TEXT[] NOT NULL DEFAULT '{}',
  exclude_keywords TEXT[] NOT NULL DEFAULT '{}',
  brand_includes TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ecommerce_category_rules_subcategory_unique UNIQUE (subcategory_id)
);

CREATE INDEX IF NOT EXISTS idx_ecommerce_category_rules_active
  ON ecommerce_category_rules (subcategory_id)
  WHERE is_active = true;

-- Ensure Therapeutic Food exists under Pet Food (may be missing on some envs).
DO $$
DECLARE
  pet_food_id UUID;
BEGIN
  SELECT id INTO pet_food_id FROM ecommerce_categories WHERE name = 'Pet Food' LIMIT 1;
  IF pet_food_id IS NULL THEN
    RAISE NOTICE 'Pet Food category missing — skip Therapeutic seed';
    RETURN;
  END IF;

  INSERT INTO ecommerce_categories (name, description, parent_category_id, display_order, is_active)
  SELECT 'Therapeutic Food', 'Prescription / therapeutic diets', pet_food_id, 0, true
  WHERE NOT EXISTS (SELECT 1 FROM ecommerce_categories WHERE name = 'Therapeutic Food');

  UPDATE ecommerce_categories
  SET parent_category_id = pet_food_id,
      is_active = COALESCE(is_active, true)
  WHERE name = 'Therapeutic Food'
    AND (parent_category_id IS DISTINCT FROM pet_food_id OR parent_category_id IS NULL);
END $$;

-- Seed Pet Food subcategory rules (keywords, not regex). Multi-match: all rules can match.
DO $$
DECLARE
  sub_id UUID;
BEGIN
  SELECT id INTO sub_id FROM ecommerce_categories WHERE name = 'Pet Treats' LIMIT 1;
  IF sub_id IS NOT NULL THEN
    INSERT INTO ecommerce_category_rules (subcategory_id, include_keywords, exclude_keywords, brand_includes, is_active)
    VALUES (
      sub_id,
      ARRAY['treat','treats','chew','chews','munchies','munchy','bone','bones','snack','snacks','biscuit','biscuits','jerky','stick','sticks','kabab','kebab','tukada'],
      ARRAY['cat litter','litter tray','litter box','litter mat'],
      ARRAY[]::TEXT[],
      true
    )
    ON CONFLICT (subcategory_id) DO UPDATE SET
      include_keywords = EXCLUDED.include_keywords,
      exclude_keywords = EXCLUDED.exclude_keywords,
      updated_at = NOW();
  END IF;

  SELECT id INTO sub_id FROM ecommerce_categories WHERE name = 'Wet Pet Food' LIMIT 1;
  IF sub_id IS NOT NULL THEN
    INSERT INTO ecommerce_category_rules (subcategory_id, include_keywords, exclude_keywords, brand_includes, is_active)
    VALUES (
      sub_id,
      ARRAY['wet','gravy','chunks in gravy','in gravy','canned','pouch','pouches','moist','pate','paté','broth','stew'],
      ARRAY['cat litter','litter tray','litter box','litter mat'],
      ARRAY[]::TEXT[],
      true
    )
    ON CONFLICT (subcategory_id) DO UPDATE SET
      include_keywords = EXCLUDED.include_keywords,
      exclude_keywords = EXCLUDED.exclude_keywords,
      updated_at = NOW();
  END IF;

  SELECT id INTO sub_id FROM ecommerce_categories WHERE name = 'Dry Pet Food' LIMIT 1;
  IF sub_id IS NOT NULL THEN
    INSERT INTO ecommerce_category_rules (subcategory_id, include_keywords, exclude_keywords, brand_includes, is_active)
    VALUES (
      sub_id,
      ARRAY['dry','kibble','kibbles','pellets','crunchy'],
      ARRAY['cat litter','litter tray','litter box','litter mat'],
      ARRAY[]::TEXT[],
      true
    )
    ON CONFLICT (subcategory_id) DO UPDATE SET
      include_keywords = EXCLUDED.include_keywords,
      exclude_keywords = EXCLUDED.exclude_keywords,
      updated_at = NOW();
  END IF;

  SELECT id INTO sub_id FROM ecommerce_categories WHERE name = 'Therapeutic Food' LIMIT 1;
  IF sub_id IS NOT NULL THEN
    INSERT INTO ecommerce_category_rules (subcategory_id, include_keywords, exclude_keywords, brand_includes, is_active)
    VALUES (
      sub_id,
      ARRAY['therapeutic','prescription diet','vet diet','prescription','renal','kidney','urinary','digestive','gastrointestinal','hypoallergenic','hydrolyzed','recovery','hepatic','cardiac'],
      ARRAY['cat litter','litter tray','litter box','litter mat','toy','accessory'],
      ARRAY[]::TEXT[],
      true
    )
    ON CONFLICT (subcategory_id) DO UPDATE SET
      include_keywords = EXCLUDED.include_keywords,
      exclude_keywords = EXCLUDED.exclude_keywords,
      updated_at = NOW();
  END IF;

  SELECT id INTO sub_id FROM ecommerce_categories WHERE name = 'Puppy Food' LIMIT 1;
  IF sub_id IS NOT NULL THEN
    INSERT INTO ecommerce_category_rules (subcategory_id, include_keywords, exclude_keywords, brand_includes, is_active)
    VALUES (
      sub_id,
      ARRAY['puppy','puppies','kitten','kittens','junior'],
      ARRAY['cat litter','litter tray','litter box','litter mat'],
      ARRAY[]::TEXT[],
      true
    )
    ON CONFLICT (subcategory_id) DO UPDATE SET
      include_keywords = EXCLUDED.include_keywords,
      exclude_keywords = EXCLUDED.exclude_keywords,
      updated_at = NOW();
  END IF;

  SELECT id INTO sub_id FROM ecommerce_categories WHERE name = 'Adult Food' LIMIT 1;
  IF sub_id IS NOT NULL THEN
    INSERT INTO ecommerce_category_rules (subcategory_id, include_keywords, exclude_keywords, brand_includes, is_active)
    VALUES (
      sub_id,
      ARRAY['adult','senior','mature','7+ years','1+ year','1+ years'],
      ARRAY['cat litter','litter tray','litter box','litter mat'],
      ARRAY[]::TEXT[],
      true
    )
    ON CONFLICT (subcategory_id) DO UPDATE SET
      include_keywords = EXCLUDED.include_keywords,
      exclude_keywords = EXCLUDED.exclude_keywords,
      updated_at = NOW();
  END IF;
END $$;

-- Normalize: products on Pet Food children → parent category_id + initial AUTO link.
DO $$
DECLARE
  pet_food_id UUID;
BEGIN
  SELECT id INTO pet_food_id FROM ecommerce_categories WHERE name = 'Pet Food' LIMIT 1;
  IF pet_food_id IS NULL THEN
    RAISE NOTICE 'Pet Food missing — skip normalize';
    RETURN;
  END IF;

  INSERT INTO product_category_links (product_id, subcategory_id, source, created_at, updated_at)
  SELECT p.id, p.category_id, 'AUTO', NOW(), NOW()
  FROM products p
  INNER JOIN ecommerce_categories ec ON ec.id = p.category_id
  WHERE ec.parent_category_id = pet_food_id
  ON CONFLICT (product_id, subcategory_id) DO NOTHING;

  UPDATE products p
  SET category_id = pet_food_id,
      category = 'Pet Food',
      updated_at = NOW()
  FROM ecommerce_categories ec
  WHERE p.category_id = ec.id
    AND ec.parent_category_id = pet_food_id;
END $$;

-- Multi-match AUTO links for all products under Pet Food parent using seeded rules.
INSERT INTO product_category_links (product_id, subcategory_id, source, created_at, updated_at)
SELECT DISTINCT p.id, r.subcategory_id, 'AUTO', NOW(), NOW()
FROM products p
INNER JOIN ecommerce_categories parent ON parent.id = p.category_id AND parent.name = 'Pet Food'
INNER JOIN ecommerce_categories child ON child.parent_category_id = parent.id
INNER JOIN ecommerce_category_rules r ON r.subcategory_id = child.id AND r.is_active = true
WHERE
  -- exclude if any exclude keyword appears in name/description/brand
  NOT EXISTS (
    SELECT 1
    FROM unnest(r.exclude_keywords) AS ek(kw)
    WHERE LENGTH(TRIM(ek.kw)) > 0
      AND (
        LOWER(COALESCE(p.name, '')) LIKE '%' || LOWER(TRIM(ek.kw)) || '%'
        OR LOWER(COALESCE(p.description, '')) LIKE '%' || LOWER(TRIM(ek.kw)) || '%'
        OR LOWER(COALESCE(p.brand, '')) LIKE '%' || LOWER(TRIM(ek.kw)) || '%'
      )
  )
  AND (
    EXISTS (
      SELECT 1
      FROM unnest(r.include_keywords) AS ik(kw)
      WHERE LENGTH(TRIM(ik.kw)) > 0
        AND (
          LOWER(COALESCE(p.name, '')) LIKE '%' || LOWER(TRIM(ik.kw)) || '%'
          OR LOWER(COALESCE(p.description, '')) LIKE '%' || LOWER(TRIM(ik.kw)) || '%'
        )
    )
    OR (
      cardinality(r.brand_includes) > 0
      AND EXISTS (
        SELECT 1
        FROM unnest(r.brand_includes) AS bi(kw)
        WHERE LENGTH(TRIM(bi.kw)) > 0
          AND LOWER(COALESCE(p.brand, '')) LIKE '%' || LOWER(TRIM(bi.kw)) || '%'
      )
    )
  )
ON CONFLICT (product_id, subcategory_id) DO NOTHING;
