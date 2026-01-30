#!/bin/bash

# Simple script to list groomer and trainer vendors
# Uses psql if available, or provides SQL for manual execution

echo "🔍 Listing Groomer and Trainer Vendors with Services"
echo "=================================================="
echo ""

# Check if psql is available
if command -v psql &> /dev/null; then
    echo "Using psql to query database..."
    echo ""
    
    # Try to get connection info from environment or use defaults
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5432}"
    DB_NAME="${DB_NAME:-warmpawz}"
    DB_USER="${DB_USER:-postgres}"
    
    echo "Connecting to: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
    echo ""
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/list-groomer-trainer-vendors.sql
    
else
    echo "⚠️  psql not found. Please run the SQL manually:"
    echo ""
    echo "SQL File: scripts/list-groomer-trainer-vendors.sql"
    echo ""
    echo "Or connect to your database and run:"
    echo ""
    cat scripts/list-groomer-trainer-vendors.sql
fi
