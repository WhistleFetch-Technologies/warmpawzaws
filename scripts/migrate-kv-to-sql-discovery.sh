#!/bin/bash

# Migration Script: KV Store to SQL for Discovery System
# TASK 8: Data migration from KV to SQL

set -e

echo "🔄 Migrating Discovery Data from KV Store to SQL..."
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it first."
    exit 1
fi

# Load environment variables
source .env

echo "✅ Environment loaded"
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first."
    exit 1
fi

echo "📋 Migration Steps:"
echo "1. Apply SQL migration (007_discovery_sql_migration.sql)"
echo "2. Migrate vendor_services data"
echo "3. Migrate staff_services data"
echo "4. Migrate search_index data"
echo "5. Verify migration"
echo ""

read -p "Continue with migration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled."
    exit 1
fi

# Step 1: Apply migration
echo ""
echo "📝 Step 1: Applying SQL migration..."
if [ -f "db/migrations/007_discovery_sql_migration.sql" ]; then
    echo "   ✓ Migration file found"
    echo "   ⚠️  Please apply migration manually using:"
    echo "      supabase db push"
    echo "   Or run the SQL file directly on your database"
else
    echo "   ❌ Migration file not found!"
    exit 1
fi

# Step 2-4: Data migration (requires custom script based on your KV structure)
echo ""
echo "📝 Step 2-4: Data migration"
echo "   ⚠️  Data migration requires:"
echo "   1. Access to KV store data"
echo "   2. Custom migration script based on your KV structure"
echo "   3. Run migration script to populate SQL tables"
echo ""
echo "   Example migration queries:"
echo "   - INSERT INTO vendor_services SELECT ... FROM kv_data"
echo "   - INSERT INTO staff_services SELECT ... FROM kv_data"
echo "   - INSERT INTO search_index SELECT ... FROM kv_data"

echo ""
echo "✅ Migration script ready!"
echo ""
echo "Next steps:"
echo "1. Apply SQL migration: supabase db push"
echo "2. Run data migration script (create based on your KV structure)"
echo "3. Verify data: SELECT COUNT(*) FROM vendor_services;"
echo "4. Test discovery endpoints"

