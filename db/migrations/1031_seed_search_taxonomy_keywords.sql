-- ============================================================================
-- MIGRATION 1031: SEED SEARCH TAXONOMY KEYWORDS
-- ============================================================================
-- Auto-generated from db/seed/search-taxonomy.csv via scripts/generate-taxonomy-migration.js
-- Idempotent: safe to re-run (ON CONFLICT DO UPDATE on hub_slug + keyword_normalized).
-- Run: ENVIRONMENT=dev node scripts/run-migration-rds-data-api.js 1031_seed_search_taxonomy_keywords.sql
-- ============================================================================

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'General Vet Care', 'Vet near me', 'vet near me', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'General Vet Care', 'Dog doctor', 'dog doctor', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'General Vet Care', 'Cat doctor', 'cat doctor', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'General Vet Care', 'Pet clinic', 'pet clinic', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'General Vet Care', 'Animal hospital', 'animal hospital', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'General Vet Care', 'Pet surgery', 'pet surgery', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Preventive Care', 'Vaccination', 'vaccination', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Preventive Care', 'Deworming', 'deworming', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Preventive Care', 'Puppy vaccination', 'puppy vaccination', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Preventive Care', 'Cat vaccination', 'cat vaccination', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Emergency Care', 'Emergency vet', 'emergency vet', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Emergency Care', '24 hour vet', '24 hour vet', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Emergency & Diagnostics', 'Pet blood test', 'pet blood test', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Emergency & Diagnostics', 'Pet scan', 'pet scan', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Emergency & Diagnostics', 'Pet X-ray', 'pet x-ray', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Specialized Care', 'Pet dentist', 'pet dentist', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Specialized Care', 'Pet physiotherapy', 'pet physiotherapy', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Specialized Care', 'Senior pet care', 'senior pet care', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Home & Online Care', 'Home vet visit', 'home vet visit', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Home & Online Care', 'Online vet consultation', 'online vet consultation', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('veterinary_and_healthcare', 'Veterinary & Healthcare', 'Home Visit', 'At home vet', 'at home vet', 'vet', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'General Grooming', 'Dog grooming', 'dog grooming', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'General Grooming', 'Cat grooming', 'cat grooming', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'General Grooming', 'Pet spa', 'pet spa', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Home Services', 'Home grooming', 'home grooming', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Home Services', 'Doorstep grooming', 'doorstep grooming', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Bath & Fur Care', 'Bath & blow dry', 'bath & blow dry', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Bath & Fur Care', 'Medicated bath', 'medicated bath', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Bath & Fur Care', 'Deshedding', 'deshedding', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Hygiene Services', 'Nail trimming', 'nail trimming', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Hygiene Services', 'Hair cut', 'hair cut', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Hygiene Services', 'Fur trimming', 'fur trimming', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Skin & Tick Care', 'Tick treatment', 'tick treatment', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Skin & Tick Care', 'Flea treatment', 'flea treatment', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Breed Specific', 'Puppy grooming', 'puppy grooming', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Breed Specific', 'Persian cat grooming', 'persian cat grooming', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Home Visit', 'At home grooming', 'at home grooming', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('grooming', 'Grooming', 'Same Day', 'Same day grooming', 'same day grooming', 'grooming', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('walking_and_sitting', 'Walking & Sitting', 'Dog Walking', 'Dog walker', 'dog walker', 'walker', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('walking_and_sitting', 'Walking & Sitting', 'Dog Walking', 'Daily dog walk', 'daily dog walk', 'walker', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('walking_and_sitting', 'Walking & Sitting', 'Dog Walking', 'Puppy walk', 'puppy walk', 'walker', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('walking_and_sitting', 'Walking & Sitting', 'Pet Sitting', 'Pet sitter', 'pet sitter', 'pet-sitter', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('walking_and_sitting', 'Walking & Sitting', 'Pet Sitting', 'Cat sitter', 'cat sitter', 'pet-sitter', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('walking_and_sitting', 'Walking & Sitting', 'Pet Sitting', 'Overnight pet sitter', 'overnight pet sitter', 'pet-sitter', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('walking_and_sitting', 'Walking & Sitting', 'Home Care', 'Home pet care', 'home pet care', 'walker', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('walking_and_sitting', 'Walking & Sitting', 'Home Care', 'Weekend pet care', 'weekend pet care', 'walker', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('walking_and_sitting', 'Walking & Sitting', 'Home Care', 'Pet nanny', 'pet nanny', 'pet-sitter', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('boarding_and_daycare', 'Boarding & Daycare', 'Boarding', 'Dog boarding', 'dog boarding', 'boarding', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('boarding_and_daycare', 'Boarding & Daycare', 'Boarding', 'Cat boarding', 'cat boarding', 'boarding', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('boarding_and_daycare', 'Boarding & Daycare', 'Boarding', 'Pet hostel', 'pet hostel', 'boarding', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('boarding_and_daycare', 'Boarding & Daycare', 'Daycare', 'Pet daycare', 'pet daycare', 'boarding', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('boarding_and_daycare', 'Boarding & Daycare', 'Daycare', 'Cage free boarding', 'cage free boarding', 'boarding', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('boarding_and_daycare', 'Boarding & Daycare', 'Premium Stays', 'Luxury pet boarding', 'luxury pet boarding', 'boarding', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('boarding_and_daycare', 'Boarding & Daycare', 'Premium Stays', 'Home boarding', 'home boarding', 'boarding', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('boarding_and_daycare', 'Boarding & Daycare', 'Premium Stays', 'Pet staycation', 'pet staycation', 'boarding', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('boarding_and_daycare', 'Boarding & Daycare', 'Specialty', 'Kennel', 'kennel', 'boarding', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('boarding_and_daycare', 'Boarding & Daycare', 'Specialty', 'Cat hotel', 'cat hotel', 'boarding', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('training_and_behaviour', 'Training & Behaviour', 'Basic Training', 'Dog trainer', 'dog trainer', 'training', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('training_and_behaviour', 'Training & Behaviour', 'Basic Training', 'Puppy training', 'puppy training', 'training', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('training_and_behaviour', 'Training & Behaviour', 'Basic Training', 'Obedience training', 'obedience training', 'training', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('training_and_behaviour', 'Training & Behaviour', 'Behaviour Correction', 'Aggressive dog training', 'aggressive dog training', 'training', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('training_and_behaviour', 'Training & Behaviour', 'Behaviour Correction', 'Behaviourist', 'behaviourist', 'training', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('training_and_behaviour', 'Training & Behaviour', 'Behaviour Correction', 'Barking', 'barking', 'training', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('training_and_behaviour', 'Training & Behaviour', 'Behaviour Correction', 'Anxiety', 'anxiety', 'training', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('training_and_behaviour', 'Training & Behaviour', 'Behaviour Correction', 'Biting', 'biting', 'training', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('training_and_behaviour', 'Training & Behaviour', 'Habit Training', 'Potty training', 'potty training', 'training', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('training_and_behaviour', 'Training & Behaviour', 'Habit Training', 'Leash training', 'leash training', 'training', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('training_and_behaviour', 'Training & Behaviour', 'Advanced Training', 'Socialization training', 'socialization training', 'training', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('training_and_behaviour', 'Training & Behaviour', 'Advanced Training', 'Therapy dog trainer', 'therapy dog trainer', 'training', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('training_and_behaviour', 'Training & Behaviour', 'Home Training', 'At home training', 'at home training', 'training', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Nutrition Services', 'Pet nutritionist', 'pet nutritionist', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Nutrition Services', 'Diet plan', 'diet plan', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Specialized Diets', 'Homemade dog food', 'homemade dog food', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Specialized Diets', 'Raw diet', 'raw diet', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Specialized Diets', 'Allergy diet', 'allergy diet', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Age Specific', 'Senior dog nutrition', 'senior dog nutrition', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Age Specific', 'Cat nutrition', 'cat nutrition', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Age Specific', 'Weight management', 'weight management', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Supplements', 'Pet supplements', 'pet supplements', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('nutrition_and_wellness', 'Nutrition & Wellness', 'Home Nutrition', 'At home nutrition', 'at home nutrition', 'nutritionist', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_food', 'Ecommerce – Food', 'Pet Food', 'Dog food', 'dog food', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_food', 'Ecommerce – Food', 'Pet Food', 'Cat food', 'cat food', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_food', 'Ecommerce – Food', 'Pet Food', 'Puppy food', 'puppy food', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_food', 'Ecommerce – Food', 'Diet Categories', 'Grain free food', 'grain free food', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_food', 'Ecommerce – Food', 'Diet Categories', 'Wet food', 'wet food', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_food', 'Ecommerce – Food', 'Diet Categories', 'Dry food', 'dry food', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_food', 'Ecommerce – Food', 'Snacks', 'Treats', 'treats', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_food', 'Ecommerce – Food', 'Snacks', 'Biscuits', 'biscuits', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_food', 'Ecommerce – Food', 'Snacks', 'Fresh food', 'fresh food', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_food', 'Ecommerce – Food', 'Snacks', 'Prescription diet', 'prescription diet', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Walking Gear', 'Dog leash', 'dog leash', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Walking Gear', 'Dog collar', 'dog collar', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Walking Gear', 'Harness', 'harness', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Walking Gear', 'Cat Collars', 'cat collars', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Walking Gear', 'Bandanas', 'bandanas', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Living Essentials', 'Pet bed', 'pet bed', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Living Essentials', 'Crate', 'crate', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Living Essentials', 'Carrier', 'carrier', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Living Essentials', 'Bowls', 'bowls', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Hygiene', 'Cat litter', 'cat litter', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Fashion', 'Pet clothes', 'pet clothes', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Fashion', 'Raincoat', 'raincoat', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Fashion', 'Shoes', 'shoes', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Entertainment', 'Toys', 'toys', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_accessories', 'Ecommerce – Accessories', 'Entertainment', 'GPS tracker', 'gps tracker', 'shop', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_health_products', 'Ecommerce – Health Products', 'Pet Medicine', 'Pet medicine', 'pet medicine', 'pharmacy', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_health_products', 'Ecommerce – Health Products', 'Skin & Coat', 'Tick shampoo', 'tick shampoo', 'pharmacy', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_health_products', 'Ecommerce – Health Products', 'Skin & Coat', 'Flea powder', 'flea powder', 'pharmacy', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_health_products', 'Ecommerce – Health Products', 'Skin & Coat', 'Skin care', 'skin care', 'pharmacy', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_health_products', 'Ecommerce – Health Products', 'Supplements', 'Supplements', 'supplements', 'pharmacy', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_health_products', 'Ecommerce – Health Products', 'Supplements', 'Calcium syrup', 'calcium syrup', 'pharmacy', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_health_products', 'Ecommerce – Health Products', 'Supplements', 'Joint care', 'joint care', 'pharmacy', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_health_products', 'Ecommerce – Health Products', 'Hygiene Products', 'Ear cleaner', 'ear cleaner', 'pharmacy', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('ecommerce_health_products', 'Ecommerce – Health Products', 'Hygiene Products', 'Dental care', 'dental care', 'pharmacy', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('insurance', 'Insurance', 'Pet Insurance', 'Pet insurance', 'pet insurance', 'insurance', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('adoption', 'Adoption', 'Adoption', 'Pet adoption', 'pet adoption', 'adoption', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('adoption', 'Adoption', 'Adoption', 'Puppy adoption', 'puppy adoption', 'adoption', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('adoption', 'Adoption', 'Adoption', 'Cat adoption', 'cat adoption', 'adoption', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('lifestyle_and_discovery', 'Lifestyle & Discovery', 'Resort', 'Pet resort', 'pet resort', 'resort', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('lifestyle_and_discovery', 'Lifestyle & Discovery', 'Resort', 'Pet friendly hotel', 'pet friendly hotel', 'resort', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('lifestyle_and_discovery', 'Lifestyle & Discovery', 'Photography', 'Pet photography', 'pet photography', 'photography', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('lifestyle_and_discovery', 'Lifestyle & Discovery', 'Cafe', 'Pet friendly cafe', 'pet friendly cafe', 'cafes', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('lifestyle_and_discovery', 'Lifestyle & Discovery', 'Breeder', 'Pet breeder', 'pet breeder', 'breeder', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('lifestyle_and_discovery', 'Lifestyle & Discovery', 'Relocation', 'Pet relocation', 'pet relocation', 'relocation', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('lifestyle_and_discovery', 'Lifestyle & Discovery', 'Travel', 'Pet travel', 'pet travel', 'relocation', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('lifestyle_and_discovery', 'Lifestyle & Discovery', 'Holiday', 'Pet holiday', 'pet holiday', 'holiday', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('location_and_convenience', 'Location & Convenience', 'Ambulance', 'Pet ambulance', 'pet ambulance', 'ambulance', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

INSERT INTO search_taxonomy_keywords
  (category_slug, category_display_name, subcategory, keyword, keyword_normalized, hub_slug, weight, is_active, updated_at)
VALUES
  ('location_and_convenience', 'Location & Convenience', 'Ambulance', 'Animal ambulance', 'animal ambulance', 'ambulance', 100, true, NOW())
ON CONFLICT (hub_slug, keyword_normalized) DO UPDATE SET
  category_slug         = EXCLUDED.category_slug,
  category_display_name = EXCLUDED.category_display_name,
  subcategory           = EXCLUDED.subcategory,
  keyword               = EXCLUDED.keyword,
  hub_slug              = EXCLUDED.hub_slug,
  is_active             = true,
  updated_at            = NOW();

-- Total inserted/upserted: 128 rows
