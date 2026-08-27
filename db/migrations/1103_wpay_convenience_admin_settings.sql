-- ============================================================================
-- MIGRATION 1103: Global WPay convenience + GST rates (admin_settings)
-- ============================================================================
-- Category 'wpay' so Marketplace feeCalculator (category 'fees') cannot read these.
-- setting_value is JSONB numeric scalars.
-- Idempotent: ON CONFLICT DO NOTHING
-- ============================================================================

INSERT INTO admin_settings (setting_category, setting_key, setting_value, description, is_active)
VALUES
  (
    'wpay',
    'wpay_convenience_fee',
    '0'::jsonb,
    'Warmpawz Pay convenience fee excluding GST (INR). Applied only at Pay Bill.',
    true
  ),
  (
    'wpay',
    'wpay_convenience_gst_rate',
    '18'::jsonb,
    'GST rate percent applied exclusively on WPay convenience fee.',
    true
  ),
  (
    'wpay',
    'wpay_platform_gst_rate',
    '18'::jsonb,
    'Inclusive GST rate used to extract GST from WPay platform revenue (G / (100 + G)).',
    true
  )
ON CONFLICT (setting_category, setting_key) DO NOTHING;
