#!/bin/bash

# ============================================================================
# Apply Events Schema Enhancement Migration (064)
# ============================================================================

set -e

echo "=========================================="
echo "Applying Events Schema Enhancement Migration"
echo "=========================================="

# Check if required environment variables are set
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    echo "Error: Database connection variables not set"
    echo "Please set: DB_HOST, DB_USER, DB_NAME"
    echo ""
    echo "Example:"
    echo "  export DB_HOST=your-rds-endpoint.amazonaws.com"
    echo "  export DB_USER=your_db_user"
    echo "  export DB_NAME=your_db_name"
    echo "  export DB_PASSWORD=your_password  # Optional, will prompt if not set"
    exit 1
fi

MIGRATION_FILE="db/migrations/064_enhance_events_schema.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "Migration file: $MIGRATION_FILE"
echo "Database: $DB_NAME"
echo "Host: $DB_HOST"
echo "User: $DB_USER"
echo ""

# Prompt for password if not set
if [ -z "$DB_PASSWORD" ]; then
    echo -n "Enter database password: "
    read -s DB_PASSWORD
    echo ""
fi

export PGPASSWORD="$DB_PASSWORD"

echo "Applying migration..."
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "Verifying columns were added..."
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name IN ('max_bookings', 'price_per_booking', 'inclusions', 'exclusions', 'terms_and_conditions', 'cancellation_policy', 'refund_policy', 'registration_rules')
        ORDER BY column_name;
    "
    echo ""
    echo "✅ Verification complete!"
else
    echo ""
    echo "❌ Migration failed!"
    exit 1
fi

unset PGPASSWORD
