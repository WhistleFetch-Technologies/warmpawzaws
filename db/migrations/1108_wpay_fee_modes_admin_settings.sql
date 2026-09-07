-- ============================================================================
-- MIGRATION 1108: WPay platform/convenience fee modes (fixed ₹ vs % of discounted amount)
-- ============================================================================
-- Modes control how wpay_platform_fee / wpay_convenience_fee are interpreted at quote time.
-- Default 'fixed' preserves existing behavior. Idempotent: ON CONFLICT DO NOTHING
-- ============================================================================

INSERT INTO admin_settings (setting_category, setting_key, setting_value, description, is_active)
VALUES
  (
    'wpay',
    'wpay_platform_fee_mode',
    '"fixed"'::jsonb,
    'Warmpawz Pay platform fee mode: fixed (₹) or percent (% of post-discount customer amount).',
    true
  ),
  (
    'wpay',
    'wpay_convenience_fee_mode',
    '"fixed"'::jsonb,
    'Warmpawz Pay convenience fee mode: fixed (₹) or percent (% of post-discount customer amount).',
    true
  )
ON CONFLICT (setting_category, setting_key) DO NOTHING;
