#!/bin/bash
# ============================================================================
# Script to run migration 600 (available_for_instant_tele) on RDS Dev
# ============================================================================
# 
# This script connects to AWS RDS Dev and runs the migration to add
# available_for_instant_tele column to vendors table.
#
# Prerequisites:
# - AWS CLI configured with appropriate credentials
# - psql client installed
# - Network access to RDS (via VPN, EC2 bastion, or direct if in VPC)
#
# Usage:
#   ./scripts/run-migration-600-rds-dev.sh
#
# ============================================================================

set -e  # Exit on error

echo "============================================================================"
echo "Running Migration 600: Add available_for_instant_tele to vendors table"
echo "Target: RDS Dev (warmpawz-dev-cluster)"
echo "============================================================================"

# Get RDS credentials from AWS Secrets Manager
echo "📋 Fetching RDS credentials from AWS Secrets Manager..."
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id warmpawz-dev-rds-master-20260106164510791100000002 \
  --query SecretString \
  --output text)

# Extract connection details
DB_HOST=$(echo $SECRET_JSON | jq -r '.host')
DB_PORT=$(echo $SECRET_JSON | jq -r '.port')
DB_NAME=$(echo $SECRET_JSON | jq -r '.dbname')
DB_USER=$(echo $SECRET_JSON | jq -r '.username')
DB_PASSWORD=$(echo $SECRET_JSON | jq -r '.password')

echo "✅ Credentials retrieved"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Check if column already exists
echo "🔍 Checking if column 'available_for_instant_tele' exists..."
COLUMN_EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
  "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'available_for_instant_tele';")

if [ "$COLUMN_EXISTS" -eq "1" ]; then
  echo "✅ Column 'available_for_instant_tele' already exists in vendors table"
  echo "   Migration 600 has already been applied. Skipping..."
  exit 0
fi

echo "⚠️  Column 'available_for_instant_tele' does not exist. Running migration..."

# Run the migration
echo "🚀 Executing migration 600..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f \
  "$(dirname "$0")/../db/migrations/600_add_vendor_available_for_instant_tele.sql"

if [ $? -eq 0 ]; then
  echo "✅ Migration 600 completed successfully!"
  echo ""
  echo "Verifying column was added..."
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c \
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'available_for_instant_tele';"
else
  echo "❌ Migration failed!"
  exit 1
fi

echo ""
echo "============================================================================"
echo "Migration 600 completed successfully!"
echo "============================================================================"
