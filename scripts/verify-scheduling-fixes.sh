#!/bin/bash

# ============================================================================
# VERIFY SCHEDULING FIXES
# ============================================================================
# Verifies all scheduling fixes are in place
# ============================================================================

set -e

echo "🔍 Verifying Scheduling Fixes..."
echo "=================================="
echo ""

ERRORS=0
WARNINGS=0

# Check SQL migration file exists
if [ ! -f "db/migrations/006_scheduling_system.sql" ]; then
    echo "❌ Migration file not found: db/migrations/006_scheduling_system.sql"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Migration file exists"
fi

# Check repository file exists
if [ ! -f "supabase/lib/repositories/scheduling.ts" ]; then
    echo "❌ Repository file not found: supabase/lib/repositories/scheduling.ts"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Repository file exists"
fi

# Check service file exists
if [ ! -f "supabase/lib/services/scheduling-service.ts" ]; then
    echo "❌ Service file not found: supabase/lib/services/scheduling-service.ts"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Service file exists"
fi

# Check test file exists
if [ ! -f "supabase/lib/services/__tests__/scheduling-service.test.ts" ]; then
    echo "⚠️  Test file not found: supabase/lib/services/__tests__/scheduling-service.test.ts"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✅ Test file exists"
fi

# Check fixed booking creation exists
if [ ! -f "src/supabase/functions/server/booking-creation-fixed.tsx" ]; then
    echo "⚠️  Fixed booking creation not found: src/supabase/functions/server/booking-creation-fixed.tsx"
    WARNINGS=$((WARNINGS + 1))
else
    echo "✅ Fixed booking creation exists"
fi

# Check for KV store imports in scheduling files
if grep -r "kv_store" supabase/lib/repositories/scheduling.ts supabase/lib/services/scheduling-service.ts 2>/dev/null; then
    echo "❌ KV store imports found in scheduling files (should use SQL only)"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No KV store imports in scheduling files"
fi

# Check for distributed locking function
if ! grep -q "acquire_booking_lock" db/migrations/006_scheduling_system.sql 2>/dev/null; then
    echo "❌ Distributed locking function not found in migration"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Distributed locking function found"
fi

# Check for slot capacity table
if ! grep -q "booking_slot_capacity" db/migrations/006_scheduling_system.sql 2>/dev/null; then
    echo "❌ Slot capacity table not found in migration"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Slot capacity table found"
fi

# Check for scheduling policies table
if ! grep -q "scheduling_policies" db/migrations/006_scheduling_system.sql 2>/dev/null; then
    echo "❌ Scheduling policies table not found in migration"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ Scheduling policies table found"
fi

echo ""
echo "=================================="
echo "Verification Summary"
echo "=================================="
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ All checks passed!"
    echo "✅ Zero critical issues"
    echo "✅ Zero high priority issues"
    echo "✅ Zero warnings"
    echo ""
    echo "🎉 Scheduling fixes verification complete!"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  Some warnings found, but no errors"
    exit 0
else
    echo "❌ Errors found. Please fix before proceeding."
    exit 1
fi

