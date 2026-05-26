-- ============================================================================
-- MIGRATION 1019: Deduplicate meal-plan tax_categories rows
-- ============================================================================
-- Keeps one "Meal Plans - Food" and one "Meal Plans - Delivery Fee" on Nutritionist
-- catalogue with meal_plan_food / meal_plan_delivery scopes. Removes mojibake duplicates.
-- ============================================================================

DO $$
DECLARE
  nut_catalog_id UUID;
  food_keep_id UUID;
  delivery_keep_id UUID;
  dup_id UUID;
  uses_name_col BOOLEAN;
  food_name TEXT := 'Meal Plans - Food';
  delivery_name TEXT := 'Meal Plans - Delivery Fee';
  label_expr TEXT;
  food_pick_sql TEXT;
  delivery_pick_sql TEXT;
  dup_food_sql TEXT;
  dup_delivery_sql TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tax_categories'
  ) THEN
    RAISE NOTICE '1019: tax_categories missing — skip';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tax_categories' AND column_name = 'name'
  ) INTO uses_name_col;

  IF uses_name_col THEN
    label_expr := 'LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(tc.name, tc.category_name, ''''), E''[\\u2013\\u2014–—]'', ''-'', ''g''), E''â€[\\u0093\\u0094"]?'', ''-'', ''g''), ''\\s+'', '' '', ''g'')))';
  ELSE
    label_expr := 'LOWER(TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(tc.category_name, ''''), E''[\\u2013\\u2014–—]'', ''-'', ''g''), E''â€[\\u0093\\u0094"]?'', ''-'', ''g''), ''\\s+'', '' '', ''g'')))';
  END IF;

  SELECT sc.id INTO nut_catalog_id
  FROM service_categories sc
  WHERE LOWER(TRIM(COALESCE(sc.category_id, ''))) = 'nutritionist'
     OR LOWER(TRIM(COALESCE(sc.name, ''))) = 'nutritionist'
  ORDER BY (LOWER(TRIM(COALESCE(sc.category_id, ''))) = 'nutritionist') DESC
  LIMIT 1;

  food_pick_sql := format(
    'SELECT tc.id FROM tax_categories tc
     WHERE %s LIKE ''%%meal plan%%''
       AND NOT (%s LIKE ''%%delivery%%'' OR COALESCE(tc.gst_application_scope, '''') = ''meal_plan_delivery'')
     ORDER BY (tc.catalog_category_id IS NOT NULL) DESC,
              (COALESCE(tc.gst_application_scope, '''') = ''meal_plan_food'') DESC,
              (EXISTS (SELECT 1 FROM tax_category_roles tcr WHERE tcr.tax_category_id = tc.id)) DESC,
              tc.created_at DESC NULLS LAST
     LIMIT 1',
    label_expr, label_expr
  );

  EXECUTE food_pick_sql INTO food_keep_id;

  delivery_pick_sql := format(
    'SELECT tc.id FROM tax_categories tc
     WHERE %s LIKE ''%%meal plan%%''
       AND (%s LIKE ''%%delivery%%'' OR COALESCE(tc.gst_application_scope, '''') = ''meal_plan_delivery'')
     ORDER BY (tc.catalog_category_id IS NOT NULL) DESC,
              (COALESCE(tc.gst_application_scope, '''') = ''meal_plan_delivery'') DESC,
              tc.created_at DESC NULLS LAST
     LIMIT 1',
    label_expr, label_expr
  );

  EXECUTE delivery_pick_sql INTO delivery_keep_id;

  IF food_keep_id IS NOT NULL THEN
    IF uses_name_col THEN
      UPDATE tax_categories SET
        name = food_name,
        category_name = food_name,
        description = COALESCE(NULLIF(TRIM(description), ''),
          'Pet prepared meals and nutrition subscriptions (food component). Default GST 5%% (prepared pet food). Admin can update.'),
        default_gst_rate = COALESCE(default_gst_rate, tax_rate, 5),
        tax_rate = COALESCE(tax_rate, default_gst_rate, 5),
        catalog_category_id = COALESCE(catalog_category_id, nut_catalog_id),
        gst_application_scope = 'meal_plan_food',
        is_active = TRUE
      WHERE id = food_keep_id;
    ELSE
      UPDATE tax_categories SET
        category_name = food_name,
        description = COALESCE(NULLIF(TRIM(description), ''),
          'Pet prepared meals and nutrition subscriptions (food component). Default GST 5%% (prepared pet food). Admin can update.'),
        tax_rate = COALESCE(tax_rate, 5),
        catalog_category_id = COALESCE(catalog_category_id, nut_catalog_id),
        gst_application_scope = 'meal_plan_food',
        is_active = TRUE
      WHERE id = food_keep_id;
    END IF;
  ELSIF nut_catalog_id IS NOT NULL THEN
    IF uses_name_col THEN
      INSERT INTO tax_categories (name, category_name, description, default_gst_rate, tax_rate, is_active, catalog_category_id, gst_application_scope)
      VALUES (food_name, food_name,
        'Pet prepared meals and nutrition subscriptions (food component). Default GST 5%% (prepared pet food). Admin can update.',
        5, 5, TRUE, nut_catalog_id, 'meal_plan_food')
      ON CONFLICT (name) DO UPDATE SET
        catalog_category_id = EXCLUDED.catalog_category_id,
        gst_application_scope = EXCLUDED.gst_application_scope,
        is_active = TRUE
      RETURNING id INTO food_keep_id;
    ELSE
      INSERT INTO tax_categories (category_name, description, tax_rate, is_active, catalog_category_id, gst_application_scope)
      VALUES (food_name,
        'Pet prepared meals and nutrition subscriptions (food component). Default GST 5%% (prepared pet food). Admin can update.',
        5, TRUE, nut_catalog_id, 'meal_plan_food')
      ON CONFLICT (category_name) DO UPDATE SET
        catalog_category_id = EXCLUDED.catalog_category_id,
        gst_application_scope = EXCLUDED.gst_application_scope,
        is_active = TRUE
      RETURNING id INTO food_keep_id;
    END IF;
  END IF;

  IF delivery_keep_id IS NOT NULL THEN
    IF uses_name_col THEN
      UPDATE tax_categories SET
        name = delivery_name,
        category_name = delivery_name,
        description = COALESCE(NULLIF(TRIM(description), ''),
          'Delivery fee component of meal plan orders. Default GST 18%%. Admin can update.'),
        default_gst_rate = COALESCE(default_gst_rate, tax_rate, 18),
        tax_rate = COALESCE(tax_rate, default_gst_rate, 18),
        catalog_category_id = COALESCE(catalog_category_id, nut_catalog_id),
        gst_application_scope = 'meal_plan_delivery',
        is_active = TRUE
      WHERE id = delivery_keep_id;
    ELSE
      UPDATE tax_categories SET
        category_name = delivery_name,
        description = COALESCE(NULLIF(TRIM(description), ''),
          'Delivery fee component of meal plan orders. Default GST 18%%. Admin can update.'),
        tax_rate = COALESCE(tax_rate, 18),
        catalog_category_id = COALESCE(catalog_category_id, nut_catalog_id),
        gst_application_scope = 'meal_plan_delivery',
        is_active = TRUE
      WHERE id = delivery_keep_id;
    END IF;
  ELSIF nut_catalog_id IS NOT NULL THEN
    IF uses_name_col THEN
      INSERT INTO tax_categories (name, category_name, description, default_gst_rate, tax_rate, is_active, catalog_category_id, gst_application_scope)
      VALUES (delivery_name, delivery_name,
        'Delivery fee component of meal plan orders. Default GST 18%%. Admin can update.',
        18, 18, TRUE, nut_catalog_id, 'meal_plan_delivery')
      ON CONFLICT (name) DO UPDATE SET
        catalog_category_id = EXCLUDED.catalog_category_id,
        gst_application_scope = EXCLUDED.gst_application_scope,
        is_active = TRUE
      RETURNING id INTO delivery_keep_id;
    ELSE
      INSERT INTO tax_categories (category_name, description, tax_rate, is_active, catalog_category_id, gst_application_scope)
      VALUES (delivery_name,
        'Delivery fee component of meal plan orders. Default GST 18%%. Admin can update.',
        18, TRUE, nut_catalog_id, 'meal_plan_delivery')
      ON CONFLICT (category_name) DO UPDATE SET
        catalog_category_id = EXCLUDED.catalog_category_id,
        gst_application_scope = EXCLUDED.gst_application_scope,
        is_active = TRUE
      RETURNING id INTO delivery_keep_id;
    END IF;
  END IF;

  dup_food_sql := format(
    'SELECT tc.id FROM tax_categories tc
     WHERE %s LIKE ''%%meal plan%%''
       AND NOT (%s LIKE ''%%delivery%%'' OR COALESCE(tc.gst_application_scope, '''') = ''meal_plan_delivery'')
       AND tc.id <> $1',
    label_expr, label_expr
  );

  IF food_keep_id IS NOT NULL THEN
    FOR dup_id IN EXECUTE dup_food_sql USING food_keep_id
    LOOP
      UPDATE meal_plans SET tax_category_id = food_keep_id WHERE tax_category_id = dup_id;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'tax_category_id') THEN
        UPDATE products SET tax_category_id = food_keep_id WHERE tax_category_id = dup_id;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'tax_category_id') THEN
        UPDATE services SET tax_category_id = food_keep_id WHERE tax_category_id = dup_id;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hsn_codes' AND column_name = 'category_id') THEN
        UPDATE hsn_codes SET category_id = food_keep_id WHERE category_id = dup_id;
      END IF;
      DELETE FROM tax_categories WHERE id = dup_id;
    END LOOP;
  END IF;

  dup_delivery_sql := format(
    'SELECT tc.id FROM tax_categories tc
     WHERE %s LIKE ''%%meal plan%%''
       AND (%s LIKE ''%%delivery%%'' OR COALESCE(tc.gst_application_scope, '''') = ''meal_plan_delivery'')
       AND tc.id <> $1',
    label_expr, label_expr
  );

  IF delivery_keep_id IS NOT NULL THEN
    FOR dup_id IN EXECUTE dup_delivery_sql USING delivery_keep_id
    LOOP
      UPDATE meal_plans SET tax_category_id = delivery_keep_id WHERE tax_category_id = dup_id;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'tax_category_id') THEN
        UPDATE products SET tax_category_id = delivery_keep_id WHERE tax_category_id = dup_id;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'tax_category_id') THEN
        UPDATE services SET tax_category_id = delivery_keep_id WHERE tax_category_id = dup_id;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'hsn_codes' AND column_name = 'category_id') THEN
        UPDATE hsn_codes SET category_id = delivery_keep_id WHERE category_id = dup_id;
      END IF;
      DELETE FROM tax_categories WHERE id = dup_id;
    END LOOP;
  END IF;

  RAISE NOTICE '1019: meal plan tax dedupe done (food=%, delivery=%)', food_keep_id, delivery_keep_id;
END $$;
