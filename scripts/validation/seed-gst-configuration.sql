-- ============================================================================
-- SEED GST CONFIGURATION FOR INDIA
-- ============================================================================

BEGIN;

-- GST Configurations for different service/product categories
INSERT INTO gst_configs (config_name, gst_percentage, cgst_percentage, sgst_percentage, igst_percentage, is_active) VALUES
    ('Standard GST 18%', 18.00, 9.00, 9.00, 18.00, true),
    ('Standard GST 12%', 12.00, 6.00, 6.00, 12.00, true),
    ('Standard GST 5%', 5.00, 2.50, 2.50, 5.00, true),
    ('GST Exempt 0%', 0.00, 0.00, 0.00, 0.00, true),
    ('Pet Food GST 18%', 18.00, 9.00, 9.00, 18.00, true),
    ('Veterinary Services 18%', 18.00, 9.00, 9.00, 18.00, true),
    ('Pet Accessories 12%', 12.00, 6.00, 6.00, 12.00, true),
    ('Pet Medicine 12%', 12.00, 6.00, 6.00, 12.00, true)
ON CONFLICT (config_name) DO NOTHING;

-- HSN Codes for pet services and products
INSERT INTO hsn_codes (hsn_code, description, gst_rate, is_active) VALUES
    ('9996', 'Veterinary Services', 18.00, true),
    ('2309', 'Pet Food Preparations', 18.00, true),
    ('4201', 'Pet Accessories (Leather)', 12.00, true),
    ('6307', 'Pet Accessories (Textile)', 12.00, true),
    ('3926', 'Pet Accessories (Plastic)', 12.00, true),
    ('3004', 'Veterinary Medicines', 12.00, true),
    ('9609', 'Pet Grooming Tools', 18.00, true),
    ('0106', 'Live Animals (Pets)', 0.00, true),
    ('9609', 'Pet Training Services', 18.00, true),
    ('9609', 'Pet Boarding Services', 18.00, true),
    ('9609', 'Pet Daycare Services', 18.00, true),
    ('9609', 'Pet Sitting Services', 18.00, true)
ON CONFLICT (hsn_code) DO NOTHING;

-- Tax Categories for different business verticals
INSERT INTO tax_categories (category_name, tax_rate, description, is_active) VALUES
    ('Veterinary Consultation', 18.00, 'Clinical veterinary services', true),
    ('Grooming Services', 18.00, 'Pet grooming and spa services', true),
    ('Training Services', 18.00, 'Pet training and behavior services', true),
    ('Boarding Services', 18.00, 'Pet boarding and daycare', true),
    ('Pet Food', 18.00, 'Commercial pet food products', true),
    ('Pet Accessories', 12.00, 'Pet accessories and supplies', true),
    ('Pet Medicine', 12.00, 'Veterinary medicines and supplements', true),
    ('Pet Insurance', 18.00, 'Pet insurance services', true),
    ('Emergency Services', 18.00, 'Emergency veterinary care', true),
    ('Diagnostic Services', 18.00, 'Diagnostic tests and imaging', true)
ON CONFLICT (category_name) DO NOTHING;

-- Platform revenue tracking (initialize)
INSERT INTO platform_revenue (revenue_date, total_revenue, commission_revenue, transaction_fees)
VALUES (CURRENT_DATE, 0, 0, 0)
ON CONFLICT (revenue_date) DO UPDATE SET revenue_date = EXCLUDED.revenue_date;

-- Refund tier configuration
INSERT INTO refund_tiers (tier_name, min_hours_before_booking, refund_percentage, is_active) VALUES
    ('Full Refund', 48, 100.00, true),
    ('Partial Refund 75%', 24, 75.00, true),
    ('Partial Refund 50%', 12, 50.00, true),
    ('Minimal Refund 25%', 6, 25.00, true),
    ('No Refund', 0, 0.00, true)
ON CONFLICT (tier_name) DO NOTHING;

-- Payout rules
INSERT INTO payout_rules (rule_name, min_payout_amount, processing_days, fee_percentage, is_active) VALUES
    ('Standard Payout', 1000.00, 7, 0.00, true),
    ('Premium Payout', 5000.00, 3, 0.00, true),
    ('Instant Payout', 100.00, 0, 2.00, true)
ON CONFLICT (rule_name) DO NOTHING;

-- Booking rules
INSERT INTO booking_rules (rule_name, rule_type, rule_config, is_active) VALUES
    ('Advance Booking Required', 'advance_booking', '{"min_hours": 2, "max_days": 30}'::jsonb, true),
    ('Cancellation Window', 'cancellation', '{"min_hours_before": 2}'::jsonb, true),
    ('Rescheduling Allowed', 'rescheduling', '{"max_reschedules": 2, "min_hours_before": 4}'::jsonb, true),
    ('Payment Required', 'payment', '{"upfront_percentage": 100}'::jsonb, true),
    ('Emergency Booking', 'other', '{"surcharge_percentage": 20}'::jsonb, true)
ON CONFLICT (rule_name) DO NOTHING;

COMMIT;

-- Verify
SELECT 'GST Configs:' as info, COUNT(*) as count FROM gst_configs;
SELECT 'HSN Codes:' as info, COUNT(*) as count FROM hsn_codes;
SELECT 'Tax Categories:' as info, COUNT(*) as count FROM tax_categories;
SELECT 'Refund Tiers:' as info, COUNT(*) as count FROM refund_tiers;
