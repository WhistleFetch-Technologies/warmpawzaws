-- ============================================================================
-- MIGRATION 759: Seed pet sitter specialization_master rows
-- ============================================================================
-- Prod stores boarding-family specs under category_id = 'boarding'. Pet Sitting
-- vendor custom-service picker filters sitter rows by specialization_id / roles;
-- only boarding rows (daycare, short_stay, …) existed, so Pet Sitting was empty.
-- Idempotent upserts aligned with vendor-spec-category-slugs SITTER_SPEC_ID_KEYS.
-- ============================================================================

INSERT INTO specialization_master (
  specialization_id,
  name,
  display_name,
  description,
  short_description,
  category_id,
  applicable_roles,
  icon_name,
  icon_color,
  display_order,
  is_active,
  show_in_problem_grid,
  show_in_vendor_profile,
  show_in_services_dashboard,
  allowed_service_styles
)
VALUES
  (
    'drop_in',
    'Drop-in Visit',
    'Drop-in Visit',
    'Short home visit to feed, play, and check on your pet',
    '30–60 min home check-in visit',
    'boarding',
    ARRAY['sitter', 'pet_sitter'],
    'Home',
    'text-teal-500',
    10,
    true,
    true,
    true,
    true,
    '["at_home"]'::jsonb
  ),
  (
    'day_visits',
    'Day Visits',
    'Day Visits',
    'One or more daytime visits while you are away',
    'Daytime in-home pet care visits',
    'boarding',
    ARRAY['sitter', 'pet_sitter'],
    'Sun',
    'text-amber-500',
    20,
    true,
    true,
    true,
    true,
    '["at_home"]'::jsonb
  ),
  (
    'overnight_sitting',
    'Overnight Sitting',
    'Overnight Sitting',
    'Pet sitter stays overnight at your home',
    'Overnight in-home pet sitting',
    'boarding',
    ARRAY['sitter', 'pet_sitter'],
    'Moon',
    'text-indigo-500',
    30,
    true,
    true,
    true,
    true,
    '["at_home"]'::jsonb
  ),
  (
    'day_sitting',
    'Day Sitting',
    'Day Sitting',
    'Full-day in-home supervision and care',
    'Full-day pet sitting at your home',
    'boarding',
    ARRAY['sitter', 'pet_sitter'],
    'Clock',
    'text-blue-500',
    40,
    true,
    true,
    true,
    true,
    '["at_home"]'::jsonb
  ),
  (
    'extended_home',
    'Extended Home Stay',
    'Extended Home Stay',
    'Multi-day in-home pet sitting',
    'Extended in-home sitting (several days)',
    'boarding',
    ARRAY['sitter', 'pet_sitter'],
    'Calendar',
    'text-purple-500',
    50,
    true,
    true,
    true,
    true,
    '["at_home"]'::jsonb
  )
ON CONFLICT (specialization_id) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  short_description = EXCLUDED.short_description,
  category_id = EXCLUDED.category_id,
  applicable_roles = EXCLUDED.applicable_roles,
  icon_name = EXCLUDED.icon_name,
  icon_color = EXCLUDED.icon_color,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  show_in_problem_grid = EXCLUDED.show_in_problem_grid,
  show_in_vendor_profile = EXCLUDED.show_in_vendor_profile,
  show_in_services_dashboard = EXCLUDED.show_in_services_dashboard,
  allowed_service_styles = EXCLUDED.allowed_service_styles,
  updated_at = NOW();
