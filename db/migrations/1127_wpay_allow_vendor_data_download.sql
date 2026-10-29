-- ============================================================================
-- MIGRATION 1127: Allow vendor earnings Excel download (admin_settings)
-- ============================================================================
-- Default off. Admin Warmpawz Pay dashboard toggle must be on before vendors
-- can download the on-screen earnings columns for a selected date window.
-- Idempotent: ON CONFLICT DO NOTHING
-- ============================================================================

INSERT INTO admin_settings (setting_category, setting_key, setting_value, description, is_active)
VALUES
  (
    'wpay',
    'wpay_allow_vendor_data_download',
    'false'::jsonb,
    'When true, vendors may download Excel of Bookings → Earnings for the selected date window (customer, channel, datetime, amount, status only).',
    true
  )
ON CONFLICT (setting_category, setting_key) DO NOTHING;
