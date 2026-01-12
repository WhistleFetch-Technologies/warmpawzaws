#!/bin/bash

# ============================================================================
# VERIFY ADMIN ENDPOINTS TABLES
# ============================================================================
# This script verifies that all required tables for admin endpoints exist
# ============================================================================

set -e

DATABASE_URL="${DATABASE_URL:-postgresql://warmpawz:warmpawz@localhost:5432/warmpawz}"

echo "🔍 Verifying Admin Endpoints Tables"
echo "===================================="
echo "Database: ${DATABASE_URL//:*@/:***@}"
echo ""

# Required tables
REQUIRED_TABLES=(
  "support_tickets"
  "chat_sessions"
  "transactions"
  "vendor_payment_rules"
  "vendor_refund_tiers"
  "vendor_support_requests"
  "compliance_issues"
)

# Check each table
MISSING_TABLES=()
EXISTING_TABLES=()

for table in "${REQUIRED_TABLES[@]}"; do
  if psql "$DATABASE_URL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" | grep -q t; then
    echo "✅ $table - EXISTS"
    EXISTING_TABLES+=("$table")
  else
    echo "❌ $table - MISSING"
    MISSING_TABLES+=("$table")
  fi
done

echo ""
echo "===================================="
echo "Summary:"
echo "  ✅ Existing: ${#EXISTING_TABLES[@]}"
echo "  ❌ Missing: ${#MISSING_TABLES[@]}"
echo ""

if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
  echo "✅ All required tables exist!"
  exit 0
else
  echo "❌ Missing tables detected. Run migration:"
  echo "   cd db && node run-migration.js migrations/053_admin_endpoints_tables.sql"
  exit 1
fi
