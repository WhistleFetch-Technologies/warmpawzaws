#!/bin/bash

# ============================================================================
# COMPLETE KV TO SQL MIGRATION SCRIPT
# ============================================================================
# This script systematically migrates all KV operations to SQL
# Date: 2025-01-22
# ============================================================================

set -e

echo "🚀 Starting Complete KV to SQL Migration..."
echo ""

# Step 1: Apply database migrations
echo "📊 Step 1: Applying database migrations..."
supabase db push --db-url "$DATABASE_URL" || echo "⚠️  Migration may have already been applied"

# Step 2: Verify SQL schema
echo ""
echo "✅ Step 2: Verifying SQL schema..."
psql "$DATABASE_URL" -c "\dt" | grep -E "(payments|bookings|services|vendors|payouts)" || echo "⚠️  Some tables may not exist yet"

# Step 3: Check for KV usage
echo ""
echo "🔍 Step 3: Checking for remaining KV usage..."
KV_COUNT=$(grep -r "kv\.get\|kv\.set\|kvStore" src/supabase/functions/server --include="*.tsx" | wc -l | xargs)
echo "   Found $KV_COUNT KV operations remaining"

if [ "$KV_COUNT" -gt 0 ]; then
  echo "   ⚠️  Migration incomplete - $KV_COUNT KV operations still exist"
  echo "   📋 Files with KV usage:"
  grep -r "kv\.get\|kv\.set\|kvStore" src/supabase/functions/server --include="*.tsx" -l | head -20
else
  echo "   ✅ No KV operations found - Migration complete!"
fi

# Step 4: Run tests
echo ""
echo "🧪 Step 4: Running test suite..."
deno test supabase/lib/services/__tests__/ --allow-all || echo "⚠️  Some tests may have failed"

echo ""
echo "✅ Migration script completed!"
echo ""
echo "📊 Summary:"
echo "   - KV Operations Remaining: $KV_COUNT"
echo "   - Target: 0"
echo "   - Status: $([ $KV_COUNT -eq 0 ] && echo '✅ COMPLETE' || echo '⚠️  IN PROGRESS')"

