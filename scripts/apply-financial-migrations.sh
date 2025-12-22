#!/bin/bash

# ============================================================================
# Apply Financial Migrations Script
# ============================================================================
# Applies migrations 008 and 009 to the database
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Financial Migrations Application${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Check if Supabase CLI is available
if command -v supabase &> /dev/null; then
    echo -e "${GREEN}✅ Supabase CLI found${NC}"
    USE_SUPABASE_CLI=true
else
    echo -e "${YELLOW}⚠️  Supabase CLI not found. Will provide manual instructions.${NC}"
    USE_SUPABASE_CLI=false
fi

# Check if migration files exist
echo ""
echo "📋 Checking migration files..."

if [ ! -f "db/migrations/008_financial_flows_complete.sql" ]; then
    echo -e "${RED}❌ Migration 008 not found!${NC}"
    exit 1
fi

if [ ! -f "db/migrations/009_financial_rpc_functions.sql" ]; then
    echo -e "${RED}❌ Migration 009 not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Migration files found${NC}"

# Method 1: Using Supabase CLI (if available)
if [ "$USE_SUPABASE_CLI" = true ]; then
    echo ""
    echo -e "${BLUE}Using Supabase CLI to apply migrations...${NC}"
    
    # Check if linked to a project
    if supabase status &> /dev/null; then
        echo -e "${GREEN}✅ Supabase project linked${NC}"
        
        echo ""
        echo "Applying Migration 008..."
        supabase db reset --db-url "$(supabase status | grep 'DB URL' | awk '{print $3}')" < db/migrations/008_financial_flows_complete.sql || {
            echo -e "${YELLOW}⚠️  Direct application failed. Using migration system...${NC}"
            # Copy to migrations folder if using Supabase migration system
            if [ -d ".supabase/migrations" ]; then
                cp db/migrations/008_financial_flows_complete.sql .supabase/migrations/$(date +%Y%m%d%H%M%S)_008_financial_flows_complete.sql
                cp db/migrations/009_financial_rpc_functions.sql .supabase/migrations/$(date +%Y%m%d%H%M%S)_009_financial_rpc_functions.sql
                echo -e "${GREEN}✅ Migrations copied to .supabase/migrations${NC}"
                echo -e "${YELLOW}Run: supabase db push${NC}"
            fi
        }
    else
        echo -e "${YELLOW}⚠️  Not linked to Supabase project${NC}"
        USE_SUPABASE_CLI=false
    fi
fi

# Method 2: Manual instructions
if [ "$USE_SUPABASE_CLI" = false ]; then
    echo ""
    echo -e "${BLUE}============================================================================${NC}"
    echo -e "${BLUE}Manual Migration Instructions${NC}"
    echo -e "${BLUE}============================================================================${NC}"
    echo ""
    echo "To apply migrations manually:"
    echo ""
    echo "1. Go to your Supabase Dashboard:"
    echo "   https://supabase.com/dashboard/project/YOUR_PROJECT_ID"
    echo ""
    echo "2. Navigate to SQL Editor"
    echo ""
    echo "3. Copy and paste the contents of:"
    echo "   ${GREEN}db/migrations/008_financial_flows_complete.sql${NC}"
    echo ""
    echo "4. Click 'Run' to execute"
    echo ""
    echo "5. Repeat for:"
    echo "   ${GREEN}db/migrations/009_financial_rpc_functions.sql${NC}"
    echo ""
    echo "6. Verify migrations applied:"
    echo "   Run this query in SQL Editor:"
    echo ""
    cat << 'EOF'
   SELECT table_name FROM information_schema.tables 
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
EOF
    echo ""
    echo -e "${GREEN}Expected: 7 rows${NC}"
    echo ""
fi

# Show migration file sizes
echo ""
echo "📊 Migration File Info:"
echo "   Migration 008: $(wc -l < db/migrations/008_financial_flows_complete.sql) lines"
echo "   Migration 009: $(wc -l < db/migrations/009_financial_rpc_functions.sql) lines"
echo ""

# Create SQL file for easy copy-paste
echo ""
echo "📝 Creating combined migration file for easy copy-paste..."
cat > /tmp/financial_migrations_combined.sql << 'EOF'
-- ============================================================================
-- COMBINED FINANCIAL MIGRATIONS
-- ============================================================================
-- Run this file in Supabase SQL Editor
-- ============================================================================

EOF

cat db/migrations/008_financial_flows_complete.sql >> /tmp/financial_migrations_combined.sql
echo "" >> /tmp/financial_migrations_combined.sql
echo "-- ============================================================================" >> /tmp/financial_migrations_combined.sql
echo "-- END OF MIGRATION 008" >> /tmp/financial_migrations_combined.sql
echo "-- ============================================================================" >> /tmp/financial_migrations_combined.sql
echo "" >> /tmp/financial_migrations_combined.sql
cat db/migrations/009_financial_rpc_functions.sql >> /tmp/financial_migrations_combined.sql

echo -e "${GREEN}✅ Combined migration file created:${NC}"
echo "   /tmp/financial_migrations_combined.sql"
echo ""
echo "   You can copy this file and paste it into Supabase SQL Editor"
echo ""

echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ Migration preparation complete!${NC}"
echo -e "${BLUE}============================================================================${NC}"

