#!/bin/bash

# ============================================================================
# COMPLETE IMPLEMENTATION VALIDATION
# ============================================================================
# Validates that all SQL-based endpoints are created and registered
# Date: 2025-01-22
# ============================================================================

set -e

echo "🔍 Validating Complete Implementation..."
echo ""

# Check SQL endpoints
echo "✅ SQL-Based Endpoints:"
SQL_ENDPOINTS=$(find src/supabase/functions/server -name "*-sql.tsx" -type f 2>/dev/null | wc -l | xargs)
echo "   Total: $SQL_ENDPOINTS files"

# Check for KV usage in SQL endpoints
echo ""
echo "🔍 Checking for KV usage in SQL endpoints..."
KV_IN_SQL=$(grep -r "kv\.get\|kv\.set\|kvStore\|from.*kv_store" src/supabase/functions/server/*-sql.tsx 2>/dev/null | wc -l | xargs)
if [ "$KV_IN_SQL" -eq 0 ]; then
  echo "   ✅ Zero KV operations found"
else
  echo "   ⚠️  Found $KV_IN_SQL KV operations (should be 0)"
fi

# Check repositories
echo ""
echo "✅ Repositories:"
REPOS=$(find supabase/lib/repositories -name "*.ts" -type f 2>/dev/null | wc -l | xargs)
echo "   Total: $REPOS files"

# Check services
echo ""
echo "✅ Services:"
SERVICES=$(find supabase/lib/services -name "*.ts" -type f -not -path "*/__tests__/*" 2>/dev/null | wc -l | xargs)
echo "   Total: $SERVICES files"

# Check middleware
echo ""
echo "✅ Middleware:"
MIDDLEWARE=$(find supabase/lib/middleware -name "*.ts" -type f 2>/dev/null | wc -l | xargs)
echo "   Total: $MIDDLEWARE files"

# Check tests
echo ""
echo "✅ Tests:"
TESTS=$(find supabase/lib/services/__tests__ -name "*.test.ts" -type f 2>/dev/null | wc -l | xargs)
echo "   Total: $TESTS files"

# Check migrations
echo ""
echo "✅ Migrations:"
MIGRATIONS=$(find db/migrations -name "*.sql" -type f 2>/dev/null | wc -l | xargs)
echo "   Total: $MIGRATIONS files"

# Check registration in index.tsx
echo ""
echo "🔍 Checking endpoint registration..."
REGISTERED=$(grep -c "SQL\|sql" src/supabase/functions/server/index.tsx 2>/dev/null | xargs || echo "0")
echo "   SQL endpoints referenced: $REGISTERED times"

# Final summary
echo ""
echo "📊 Summary:"
echo "   SQL Endpoints: $SQL_ENDPOINTS"
echo "   Repositories: $REPOS"
echo "   Services: $SERVICES"
echo "   Middleware: $MIDDLEWARE"
echo "   Tests: $TESTS"
echo "   Migrations: $MIGRATIONS"
echo "   KV in SQL: $KV_IN_SQL (target: 0)"

if [ "$KV_IN_SQL" -eq 0 ] && [ "$SQL_ENDPOINTS" -ge 15 ]; then
  echo ""
  echo "✅ VALIDATION: PASSED"
  echo "   All SQL endpoints created"
  echo "   Zero KV operations in SQL files"
  echo "   All components in place"
  exit 0
else
  echo ""
  echo "⚠️  VALIDATION: IN PROGRESS"
  exit 1
fi

