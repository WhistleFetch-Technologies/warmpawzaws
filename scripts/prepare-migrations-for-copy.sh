#!/bin/bash

# ============================================================================
# Prepare Migrations for Copy-Paste
# ============================================================================
# Creates formatted files ready to copy into Supabase SQL Editor
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Preparing Migrations for Supabase SQL Editor${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Create output directory
OUTPUT_DIR="./migrations-ready"
mkdir -p "$OUTPUT_DIR"

# Migration 008
echo "📝 Preparing Migration 008..."
cat > "$OUTPUT_DIR/008_financial_flows_complete.sql" << 'EOF'
-- ============================================================================
-- MIGRATION 008: Complete Financial Flows - SQL Only
-- Copy this entire file and paste into Supabase SQL Editor
-- ============================================================================

EOF

cat db/migrations/008_financial_flows_complete.sql >> "$OUTPUT_DIR/008_financial_flows_complete.sql"

# Migration 009
echo "📝 Preparing Migration 009..."
cat > "$OUTPUT_DIR/009_financial_rpc_functions.sql" << 'EOF'
-- ============================================================================
-- MIGRATION 009: Financial RPC Functions
-- Copy this entire file and paste into Supabase SQL Editor
-- ============================================================================

EOF

cat db/migrations/009_financial_rpc_functions.sql >> "$OUTPUT_DIR/009_financial_rpc_functions.sql"

# Combined migration
echo "📝 Creating combined migration..."
cat > "$OUTPUT_DIR/COMBINED_ALL_MIGRATIONS.sql" << 'EOF'
-- ============================================================================
-- COMBINED FINANCIAL MIGRATIONS
-- Copy this entire file and paste into Supabase SQL Editor
-- This applies both migrations 008 and 009 at once
-- ============================================================================

EOF

cat db/migrations/008_financial_flows_complete.sql >> "$OUTPUT_DIR/COMBINED_ALL_MIGRATIONS.sql"
echo "" >> "$OUTPUT_DIR/COMBINED_ALL_MIGRATIONS.sql"
echo "-- ============================================================================" >> "$OUTPUT_DIR/COMBINED_ALL_MIGRATIONS.sql"
echo "-- END OF MIGRATION 008" >> "$OUTPUT_DIR/COMBINED_ALL_MIGRATIONS.sql"
echo "-- ============================================================================" >> "$OUTPUT_DIR/COMBINED_ALL_MIGRATIONS.sql"
echo "" >> "$OUTPUT_DIR/COMBINED_ALL_MIGRATIONS.sql"
cat db/migrations/009_financial_rpc_functions.sql >> "$OUTPUT_DIR/COMBINED_ALL_MIGRATIONS.sql"

# Verification query
echo "📝 Creating verification query..."
cat > "$OUTPUT_DIR/VERIFY_MIGRATIONS.sql" << 'EOF'
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
EOF

echo ""
echo -e "${GREEN}✅ Migrations prepared!${NC}"
echo ""
echo "Files created in: ${BLUE}$OUTPUT_DIR${NC}"
echo ""
echo "📋 Files:"
echo "   1. ${GREEN}008_financial_flows_complete.sql${NC} - Migration 008 (copy this first)"
echo "   2. ${GREEN}009_financial_rpc_functions.sql${NC} - Migration 009 (copy this second)"
echo "   3. ${GREEN}COMBINED_ALL_MIGRATIONS.sql${NC} - Both migrations combined (copy this if you want to apply both at once)"
echo "   4. ${GREEN}VERIFY_MIGRATIONS.sql${NC} - Verification query (run this after migrations)"
echo ""
echo "📝 Instructions:"
echo "   1. Open Supabase Dashboard → SQL Editor"
echo "   2. Copy contents of 008_financial_flows_complete.sql"
echo "   3. Paste and click 'Run'"
echo "   4. Copy contents of 009_financial_rpc_functions.sql"
echo "   5. Paste and click 'Run'"
echo "   6. Copy contents of VERIFY_MIGRATIONS.sql"
echo "   7. Paste and click 'Run' to verify"
echo ""
echo -e "${BLUE}============================================================================${NC}"

