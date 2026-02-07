#!/bin/bash

# ============================================================================
# MIGRATION 253: ADD staff_id COLUMN TO gps_tracking_sessions
# ============================================================================
# 
# This script applies migration 253 using the Node.js script
# 
# Usage:
#   ./scripts/apply-migration-253-staff-id-gps-tracking.sh
# 
# Or with environment variables:
#   DB_HOST=your-host DB_NAME=your-db DB_SECRET_ARN=your-arn ./scripts/apply-migration-253-staff-id-gps-tracking.sh
# ============================================================================

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "============================================================================"
echo "🚀 APPLYING MIGRATION 253: Add staff_id to gps_tracking_sessions"
echo "============================================================================"
echo ""

# Load environment variables if .env file exists
if [ -f "$PROJECT_ROOT/.env" ]; then
  echo "📥 Loading environment variables from .env file..."
  export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
fi

# Check if required environment variables are set
if [ -z "$DB_HOST" ] && [ -z "$RDS_HOSTNAME" ]; then
  echo "❌ Error: DB_HOST or RDS_HOSTNAME environment variable is not set"
  echo ""
  echo "Please set one of the following:"
  echo "  export DB_HOST=your-database-host"
  echo "  export RDS_HOSTNAME=your-database-host"
  exit 1
fi

if [ -z "$DB_NAME" ] && [ -z "$RDS_DB_NAME" ]; then
  echo "❌ Error: DB_NAME or RDS_DB_NAME environment variable is not set"
  echo ""
  echo "Please set one of the following:"
  echo "  export DB_NAME=your-database-name"
  echo "  export RDS_DB_NAME=your-database-name"
  exit 1
fi

# Set defaults if using RDS_* variables
export DB_HOST="${DB_HOST:-$RDS_HOSTNAME}"
export DB_NAME="${DB_NAME:-$RDS_DB_NAME}"
export DB_USER="${DB_USER:-$RDS_USERNAME}"
export DB_PASSWORD="${DB_PASSWORD:-$RDS_PASSWORD}"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
  echo "❌ Error: Node.js is not installed or not in PATH"
  echo ""
  echo "Please install Node.js to run this migration script"
  exit 1
fi

# Check if pg package is installed (required dependency)
if [ ! -d "$PROJECT_ROOT/node_modules/pg" ] && [ ! -d "$PROJECT_ROOT/backend/lambda/node_modules/pg" ]; then
  echo "⚠️  Warning: pg package not found. Installing dependencies..."
  cd "$PROJECT_ROOT/backend/lambda" || exit 1
  npm install pg @aws-sdk/client-secrets-manager
fi

# Run the migration script
echo "📝 Running migration script..."
echo ""

cd "$PROJECT_ROOT" || exit 1
node "$SCRIPT_DIR/apply-migration-253-staff-id-gps-tracking.js"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "============================================================================"
  echo "✅ MIGRATION COMPLETE"
  echo "============================================================================"
else
  echo ""
  echo "============================================================================"
  echo "❌ MIGRATION FAILED"
  echo "============================================================================"
fi

exit $EXIT_CODE
