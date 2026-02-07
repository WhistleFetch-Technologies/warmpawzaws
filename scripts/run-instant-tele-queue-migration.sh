#!/bin/bash

# ============================================================================
# Run Instant Tele Queue Database Migration
# ============================================================================
# This script runs the instant tele queue database migration
# ============================================================================

set -e  # Exit on error

echo "🚀 Starting Instant Tele Queue Database Migration..."
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found"
    echo "   Please install PostgreSQL client tools"
    exit 1
fi

# Get database connection details
# Option 1: From environment variables
DB_HOST="${DB_HOST:-${RDS_HOSTNAME}}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-${RDS_DB_NAME:-warmpawz_db}}"
DB_USER="${DB_USER:-${RDS_USERNAME}}"
DB_PASSWORD="${DB_PASSWORD:-${RDS_PASSWORD}}"

# Option 2: From command line arguments
if [ "$1" ]; then
    DB_HOST="$1"
fi
if [ "$2" ]; then
    DB_USER="$2"
fi
if [ "$3" ]; then
    DB_NAME="$3"
fi

# Prompt for missing values
if [ -z "$DB_HOST" ]; then
    read -p "Enter database host: " DB_HOST
fi

if [ -z "$DB_USER" ]; then
    read -p "Enter database username: " DB_USER
fi

if [ -z "$DB_NAME" ]; then
    read -p "Enter database name [warmpawz_db]: " DB_NAME
    DB_NAME="${DB_NAME:-warmpawz_db}"
fi

if [ -z "$DB_PASSWORD" ]; then
    read -sp "Enter database password: " DB_PASSWORD
    echo ""
fi

# Set PGPASSWORD environment variable for non-interactive password
export PGPASSWORD="$DB_PASSWORD"

# Migration file path
MIGRATION_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backend/lambda/src/database/schemas/instant-tele-queue.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📁 Migration file: $MIGRATION_FILE"
echo "🔌 Connecting to: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# Test connection
echo "🔍 Testing database connection..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
else
    echo "❌ Error: Failed to connect to database"
    echo "   Please check your credentials and network connection"
    exit 1
fi

echo ""
echo "📊 Current database state:"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_tele_availability')
        THEN '✅ staff_tele_availability exists'
        ELSE '❌ staff_tele_availability missing'
    END as staff_tele_availability_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tele_queue')
        THEN '✅ tele_queue exists'
        ELSE '❌ tele_queue missing'
    END as tele_queue_status;
EOF

echo ""
echo "🔄 Running migration..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run migration
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📊 Verifying tables created:"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
    (SELECT COUNT(*) FROM information_schema.indexes WHERE tablename = t.table_name) as index_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('staff_tele_availability', 'tele_queue')
ORDER BY table_name;
EOF

    echo ""
    echo "✅ Migration verification complete!"
    echo ""
    echo "🎉 Next steps:"
    echo "   1. Deploy backend Lambda function"
    echo "   2. Deploy frontend applications"
    echo "   3. Test the features"
    echo ""
else
    echo ""
    echo "❌ Migration failed!"
    echo "   Please check the error messages above"
    exit 1
fi

# Clean up password from environment
unset PGPASSWORD
