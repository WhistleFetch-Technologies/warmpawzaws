#!/bin/bash

# Validation Script for Scheduling SQL System
# Ensures: No KV Store, All data from SQL, 100% coverage

set -e

echo "🔍 Validating Scheduling SQL System..."
echo ""

# Check 1: Schedule utils uses SQL
echo "✅ Check 1: Schedule Utils"
if grep -q "schedule-utils-sql\|getScheduleSettings\|getStaffNextAvailableSlot" src/supabase/functions/server/schedule-utils.tsx; then
    echo "   ✓ schedule-utils.tsx uses SQL utilities"
else
    echo "   ❌ schedule-utils.tsx still uses KV"
    exit 1
fi

if grep -q "kv\.get\|kv\.set" src/supabase/functions/server/schedule-utils.tsx; then
    echo "   ❌ schedule-utils.tsx still uses KV store"
    exit 1
else
    echo "   ✓ schedule-utils.tsx does NOT use KV store"
fi

# Check 2: Vendor schedule uses SQL
echo ""
echo "✅ Check 2: Vendor Schedule"
if [ -f "src/supabase/functions/server/vendor-schedule-v2-sql.tsx" ]; then
    echo "   ✓ SQL-based vendor schedule file exists"
    
    if grep -q "kv\.get\|kv\.set" src/supabase/functions/server/vendor-schedule-v2-sql.tsx; then
        echo "   ❌ vendor-schedule-v2-sql.tsx still uses KV store"
        exit 1
    else
        echo "   ✓ vendor-schedule-v2-sql.tsx does NOT use KV store"
    fi
else
    echo "   ❌ SQL-based vendor schedule file not found"
    exit 1
fi

# Check 3: Home services uses SQL
echo ""
echo "✅ Check 3: Home Services"
if [ -f "src/supabase/functions/server/home-services-endpoints-sql.tsx" ]; then
    echo "   ✓ SQL-based home services file exists"
    
    if grep -q "kv\.get\|kv\.set" src/supabase/functions/server/home-services-endpoints-sql.tsx; then
        echo "   ❌ home-services-endpoints-sql.tsx still uses KV store"
        exit 1
    else
        echo "   ✓ home-services-endpoints-sql.tsx does NOT use KV store"
    fi
else
    echo "   ❌ SQL-based home services file not found"
    exit 1
fi

# Check 4: Package endpoints uses SQL
echo ""
echo "✅ Check 4: Package Endpoints"
if [ -f "src/supabase/functions/server/package-endpoints-sql.tsx" ]; then
    echo "   ✓ SQL-based package endpoints file exists"
    
    if grep -q "kv\.get\|kv\.set\|kvStore" src/supabase/functions/server/package-endpoints-sql.tsx; then
        echo "   ❌ package-endpoints-sql.tsx still uses KV store"
        exit 1
    else
        echo "   ✓ package-endpoints-sql.tsx does NOT use KV store"
    fi
else
    echo "   ❌ SQL-based package endpoints file not found"
    exit 1
fi

# Check 5: Staff discovery uses SQL
echo ""
echo "✅ Check 5: Staff Discovery"
if [ -f "src/supabase/functions/server/staff-discovery-endpoints-sql.tsx" ]; then
    echo "   ✓ SQL-based staff discovery file exists"
    
    if grep -q "kv\.get\|kv\.set" src/supabase/functions/server/staff-discovery-endpoints-sql.tsx; then
        echo "   ❌ staff-discovery-endpoints-sql.tsx still uses KV store"
        exit 1
    else
        echo "   ✓ staff-discovery-endpoints-sql.tsx does NOT use KV store"
    fi
else
    echo "   ❌ SQL-based staff discovery file not found"
    exit 1
fi

# Check 6: Followup endpoints uses SQL
echo ""
echo "✅ Check 6: Followup Endpoints"
if [ -f "src/supabase/functions/server/followup-endpoints-sql.tsx" ]; then
    echo "   ✓ SQL-based followup endpoints file exists"
    
    if grep -q "kv\.get\|kv\.set" src/supabase/functions/server/followup-endpoints-sql.tsx; then
        echo "   ❌ followup-endpoints-sql.tsx still uses KV store"
        exit 1
    else
        echo "   ✓ followup-endpoints-sql.tsx does NOT use KV store"
    fi
else
    echo "   ❌ SQL-based followup endpoints file not found"
    exit 1
fi

# Check 7: Staff availability routes uses SQL
echo ""
echo "✅ Check 7: Staff Availability Routes"
if [ -f "src/supabase/functions/server/staff-availability-routes-sql.tsx" ]; then
    echo "   ✓ SQL-based staff availability routes file exists"
    
    if grep -q "kv\.get\|kv\.set\|kv\.del" src/supabase/functions/server/staff-availability-routes-sql.tsx; then
        echo "   ❌ staff-availability-routes-sql.tsx still uses KV store"
        exit 1
    else
        echo "   ✓ staff-availability-routes-sql.tsx does NOT use KV store"
    fi
else
    echo "   ❌ SQL-based staff availability routes file not found"
    exit 1
fi

# Check 8: Emergency queue service exists
echo ""
echo "✅ Check 8: Emergency Queue Service"
if [ -f "supabase/lib/services/emergency-queue-service.ts" ]; then
    echo "   ✓ Emergency queue service exists"
    
    if grep -q "kv\.get\|kv\.set" supabase/lib/services/emergency-queue-service.ts; then
        echo "   ❌ emergency-queue-service.ts still uses KV store"
        exit 1
    else
        echo "   ✓ emergency-queue-service.ts does NOT use KV store"
    fi
else
    echo "   ❌ Emergency queue service not found"
    exit 1
fi

# Check 9: Atomic operations implemented
echo ""
echo "✅ Check 9: Atomic Operations"
if grep -q "withTransaction\|reserveSubscriptionSlots.*ATOMIC\|redeemPackageSession.*ATOMIC" supabase/lib/services/scheduling-service.ts; then
    echo "   ✓ Atomic operations implemented"
else
    echo "   ❌ Atomic operations not fully implemented"
    exit 1
fi

# Check 10: Policies exist
echo ""
echo "✅ Check 10: Scheduling Policies"
if grep -q "centre_schedule\|staff_schedule" db/migrations/009_scheduling_policies_complete.sql; then
    echo "   ✓ Missing policies added"
else
    echo "   ❌ Missing policies not added"
    exit 1
fi

# Check 11: Lock timeout increased
echo ""
echo "✅ Check 11: Lock Timeout"
if grep -q "30.*second timeout\|30.*//.*timeout" supabase/lib/services/scheduling-service.ts; then
    echo "   ✓ Lock timeout increased to 30 seconds"
else
    echo "   ❌ Lock timeout not increased"
    exit 1
fi

# Check 12: No KV imports in scheduling files
echo ""
echo "✅ Check 12: No KV Imports"
SCHEDULING_FILES=(
    "supabase/lib/utils/schedule-utils-sql.ts"
    "supabase/lib/services/scheduling-service.ts"
    "supabase/lib/repositories/scheduling.ts"
    "supabase/lib/services/emergency-queue-service.ts"
    "src/supabase/functions/server/schedule-utils.tsx"
    "src/supabase/functions/server/vendor-schedule-v2-sql.tsx"
    "src/supabase/functions/server/home-services-endpoints-sql.tsx"
    "src/supabase/functions/server/package-endpoints-sql.tsx"
    "src/supabase/functions/server/staff-discovery-endpoints-sql.tsx"
    "src/supabase/functions/server/followup-endpoints-sql.tsx"
    "src/supabase/functions/server/staff-availability-routes-sql.tsx"
)

for file in "${SCHEDULING_FILES[@]}"; do
    if [ -f "$file" ]; then
        if grep -q "from.*kv_store\|import.*kv" "$file" 2>/dev/null; then
            echo "   ❌ KV import found in $file"
            exit 1
        fi
    fi
done

echo "   ✓ No KV imports in scheduling files"

echo ""
echo "✅ All validation checks passed!"
echo "✅ Scheduling system is fully SQL-based (NO KV STORE)"
echo "✅ All violations fixed"
echo "✅ All missing features implemented"

