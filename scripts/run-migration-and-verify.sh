#!/bin/bash

# ============================================================================
# RUN MIGRATION AND VERIFY TABLES
# ============================================================================
# This script runs the admin endpoints migration and verifies tables were created
# ============================================================================

set -e

echo "🚀 Admin Endpoints Migration & Verification"
echo "============================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set. Checking .env.local..."
  if [ -f "../.env.local" ]; then
    export $(grep -v '^#' ../.env.local | grep DATABASE_URL | xargs)
  fi
fi

DATABASE_URL="${DATABASE_URL:-postgresql://warmpawz:warmpawz@localhost:5432/warmpawz}"

echo "📁 Migration file: db/migrations/053_admin_endpoints_tables.sql"
echo "🔌 Database: ${DATABASE_URL//:*@/:***@}"
echo ""

# Step 1: Run migration
echo "Step 1: Running migration..."
echo "────────────────────────────"

cd "$(dirname "$0")/../db" || exit 1

if node run-migration.js migrations/053_admin_endpoints_tables.sql; then
  echo "✅ Migration completed successfully"
else
  echo "❌ Migration failed. Check the error above."
  echo ""
  echo "💡 Troubleshooting:"
  echo "   1. Verify database is running"
  echo "   2. Check DATABASE_URL is correct"
  echo "   3. Verify database user has CREATE TABLE permissions"
  exit 1
fi

echo ""
echo "Step 2: Verifying tables..."
echo "────────────────────────────"

# Step 2: Verify tables
cd "$(dirname "$0")" || exit 1

if ./verify-admin-tables.sh; then
  echo ""
  echo "✅ All tables verified successfully!"
  echo ""
  echo "🎉 Migration and verification complete!"
  echo ""
  echo "Next steps:"
  echo "  1. Test endpoints: ./test-admin-endpoints.sh"
  echo "  2. Verify UI components load correctly"
  echo "  3. Deploy when ready"
else
  echo ""
  echo "❌ Some tables are missing. Check the output above."
  exit 1
fi
