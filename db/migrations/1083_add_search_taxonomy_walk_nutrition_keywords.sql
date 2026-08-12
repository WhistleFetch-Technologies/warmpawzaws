-- ============================================================================
-- MIGRATION 1083: ADDITIVE SEARCH TAXONOMY KEYWORDS (walk + nutrition NL)
-- ============================================================================
-- Walking/sitting and nutrition consultation phrases for sentence-level search.
-- Idempotent: safe to re-run (ON CONFLICT DO UPDATE on hub_slug + keyword_normalized).
-- ============================================================================

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('walking_and_sitting', 'Walking & Sitting', 'Dog Walking', 'Dog walk', 'dog walk', 'walker', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('walking_and_sitting', 'Walking & Sitting', 'Dog Walking', 'Dog walking', 'dog walking', 'walker', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('walking_and_sitting', 'Walking & Sitting', 'Dog Walking', 'Walk my dog', 'walk my dog', 'walker', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('walking_and_sitting', 'Walking & Sitting', 'Dog Walking', 'Walking my dog', 'walking my dog', 'walker', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Nutrition Services', 'Diet consultation', 'diet consultation', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Nutrition Services', 'Diet consultant', 'diet consultant', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Nutrition Services', 'Nutrition consultation', 'nutrition consultation', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Nutrition Services', 'Nutrition consultant', 'nutrition consultant', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  is_active             = true,
  updated_at            = NOW();
