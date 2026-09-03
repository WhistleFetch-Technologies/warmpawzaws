-- ============================================================================
-- MIGRATION 1104: Global WPay platform fee + GST (admin_settings)
-- ============================================================================
-- Category 'wpay' so Marketplace feeCalculator (category 'fees') cannot read these.
-- Platform fee GST is exclusive (on top of fee), same pattern as convenience fee.
-- Platform revenue GST (wpay_platform_gst_rate) remains inclusive extract from C−D.
-- Idempotent: ON CONFLICT DO NOTHING
-- ============================================================================

INSERT INTO admin_settings (setting_category, setting_key, setting_value, description, is_active)
VALUES
  (
    'wpay',
    'wpay_platform_fee',
    '0'::jsonb,
    'Warmpawz Pay platform fee excluding GST (INR). Applied only at Pay Bill.',
    true
  ),
  (
    'wpay',
    'wpay_platform_fee_gst_rate',
    '18'::jsonb,
    'GST rate percent applied exclusively on WPay platform fee (on top).',
    true
  )
ON CONFLICT (setting_category, setting_key) DO NOTHING;
