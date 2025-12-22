#!/bin/bash

# ============================================================================
# VALIDATE SQL MIGRATION COMPLETENESS
# ============================================================================
# Checks for remaining KV operations and validates SQL migration status
# Date: 2025-01-22
# ============================================================================

set -e

echo "🔍 Validating SQL Migration Status..."
echo ""

# Check for KV operations in server endpoints
echo "📊 Checking for KV operations in server endpoints..."
KV_COUNT=$(grep -r "kv\.get\|kv\.set\|kvStore\|from.*kv_store" src/supabase/functions/server --include="*.tsx" 2>/dev/null | wc -l | xargs)
echo "   Found: $KV_COUNT KV operations"

if [ "$KV_COUNT" -eq 0 ]; then
  echo "   ✅ No KV operations found - Migration complete!"
else
  echo "   ⚠️  $KV_COUNT KV operations still exist"
  echo ""
  echo "   📋 Top files with KV usage:"
  grep -r "kv\.get\|kv\.set\|kvStore\|from.*kv_store" src/supabase/functions/server --include="*.tsx" -l 2>/dev/null | head -10 | while read file; do
    count=$(grep -c "kv\.get\|kv\.set\|kvStore\|from.*kv_store" "$file" 2>/dev/null || echo "0")
    echo "      - $file ($count occurrences)"
  done
fi

echo ""

# Check for SQL-based endpoints
echo "✅ Checking for SQL-based endpoints..."
SQL_ENDPOINTS=$(find src/supabase/functions/server -name "*-sql.tsx" -type f 2>/dev/null | wc -l | xargs)
echo "   Found: $SQL_ENDPOINTS SQL-based endpoint files"

if [ "$SQL_ENDPOINTS" -gt 0 ]; then
  echo "   📋 SQL-based endpoints:"
  find src/supabase/functions/server -name "*-sql.tsx" -type f 2>/dev/null | while read file; do
    echo "      - $(basename $file)"
  done
fi

echo ""

# Check for repositories
echo "📚 Checking for SQL repositories..."
REPOS=$(find supabase/lib/repositories -name "*.ts" -type f 2>/dev/null | wc -l | xargs)
echo "   Found: $REPOS repository files"

echo ""

# Calculate migration percentage
TOTAL_FILES=$(find src/supabase/functions/server -name "*.tsx" -type f 2>/dev/null | wc -l | xargs)
MIGRATED_FILES=$SQL_ENDPOINTS
if [ "$TOTAL_FILES" -gt 0 ]; then
  PERCENTAGE=$((MIGRATED_FILES * 100 / TOTAL_FILES))
  echo "📊 Migration Progress:"
  echo "   Total endpoint files: $TOTAL_FILES"
  echo "   Migrated files: $MIGRATED_FILES"
  echo "   Progress: $PERCENTAGE%"
else
  echo "📊 Migration Progress: Unable to calculate"
fi

echo ""

# Final status
if [ "$KV_COUNT" -eq 0 ]; then
  echo "✅ VALIDATION: PASSED - No KV operations found"
  exit 0
else
  echo "⚠️  VALIDATION: IN PROGRESS - $KV_COUNT KV operations remaining"
  exit 1
fi

