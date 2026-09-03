-- ============================================================================
-- MIGRATION 1106: Global WPay burn/test mode flag (admin_settings)
-- ============================================================================
-- When true: customer still gets displayed discount + fees; vendor is paid full quote Q;
-- platform funds the discount (burn). Publish still requires D < C. Default off.
-- Idempotent: ON CONFLICT DO NOTHING
-- ============================================================================

INSERT INTO admin_settings (setting_category, setting_key, setting_value, description, is_active)
VALUES
  (
    'wpay',
    'wpay_burn_mode',
    'false'::jsonb,
    'Warmpawz Pay burn/test mode. When true, vendor receives full quoted amount; platform funds customer discount. Fees unchanged.',
    true
  )
ON CONFLICT (setting_category, setting_key) DO NOTHING;
