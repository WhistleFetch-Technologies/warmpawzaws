-- ============================================================================
-- VERIFICATION QUERY
-- Run this after applying migrations to verify everything was created
-- ============================================================================

-- Check tables (should return 7 rows)
SELECT 
    'Tables' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 7 THEN '✅ PASS'
        ELSE '❌ FAIL - Expected 7 tables'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'gst_rules',
    'vendor_tiers',
    'vendor_tier_subscriptions',
    'tier_upgrade_payments',
    'settlement_booking_mappings',
    'coupon_usage',
    'platform_revenue_monthly'
);

-- List all created tables
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN (
    'gst_rules',
    'vendor_tiers',
    'vendor_tier_subscriptions',
    'tier_upgrade_payments',
    'settlement_booking_mappings',
    'coupon_usage',
    'platform_revenue_monthly'
)
ORDER BY table_name;

-- Check functions (should return 6 rows)
SELECT 
    'Functions' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) = 6 THEN '✅ PASS'
        ELSE '❌ FAIL - Expected 6 functions'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'update_vendor_earnings',
    'reverse_vendor_earnings',
    'reverse_platform_commission',
    'check_coupon_usage',
    'get_vendor_commission_rate',
    'create_settlement'
);

-- List all created functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'update_vendor_earnings',
    'reverse_vendor_earnings',
    'reverse_platform_commission',
    'check_coupon_usage',
    'get_vendor_commission_rate',
    'create_settlement'
)
ORDER BY routine_name;

-- Check default data
SELECT 
    'Default Tier' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) >= 1 THEN '✅ PASS'
        ELSE '❌ FAIL - No default tier found'
    END as status
FROM vendor_tiers 
WHERE tier_name = 'bronze' AND is_active = true;

SELECT 
    'Default GST Rule' as check_type,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) >= 1 THEN '✅ PASS'
        ELSE '❌ FAIL - No default GST rule found'
    END as status
FROM gst_rules 
WHERE rule_name LIKE '%Default%' AND enabled = true;
