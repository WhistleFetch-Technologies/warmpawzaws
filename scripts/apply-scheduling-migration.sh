#!/bin/bash

# ============================================================================
# APPLY SCHEDULING MIGRATION
# ============================================================================
# Applies the scheduling system SQL migration
# ============================================================================

set -e

echo "📦 Applying Scheduling System Migration..."
echo "=========================================="
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Applying migration directly to database..."
    echo ""
    echo "Please run the migration manually:"
    echo "  psql -d your_database -f db/migrations/006_scheduling_system.sql"
    echo ""
    exit 1
fi

# Apply migration
echo "🔄 Applying migration: 006_scheduling_system.sql"
supabase db push --db-url "$DATABASE_URL" < db/migrations/006_scheduling_system.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Update booking endpoints to use booking-creation-fixed.tsx"
    echo "  2. Run tests: ./scripts/run-scheduling-tests.sh"
    echo "  3. Verify all tests pass"
    echo ""
    exit 0
else
    echo ""
    echo "❌ Migration failed"
    exit 1
fi

