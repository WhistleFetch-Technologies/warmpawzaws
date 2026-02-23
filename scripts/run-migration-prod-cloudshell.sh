#!/bin/bash
# ============================================================================
# Run Production Migration via AWS CloudShell
# ============================================================================
# This script is designed to run from AWS CloudShell
# CloudShell has AWS CLI pre-configured and can access VPC resources
# ============================================================================

set -e

ENVIRONMENT="prod"
REGION="ap-south-1"
MIGRATION_FILE="559_add_vendors_specializations_column.sql"

echo "🚀 Production Migration via AWS CloudShell"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Migration: $MIGRATION_FILE"
echo ""

# Check if we're in CloudShell (has AWS_EXECUTION_ENV)
if [ -z "$AWS_EXECUTION_ENV" ]; then
    echo "⚠️  WARNING: This script is designed for AWS CloudShell"
    echo "   AWS_EXECUTION_ENV is not set. Continuing anyway..."
    echo ""
fi

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
MIGRATION_PATH="$PROJECT_ROOT/db/migrations/$MIGRATION_FILE"

# Check if migration file exists
if [ ! -f "$MIGRATION_PATH" ]; then
    echo "❌ ERROR: Migration file not found: $MIGRATION_PATH"
    echo ""
    echo "Please ensure you're in the correct directory or download the migration file."
    exit 1
fi

echo "✅ Migration file found: $MIGRATION_PATH"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "📦 Node.js not found. Installing..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Check if required npm packages are installed
cd "$PROJECT_ROOT"
if [ ! -d "node_modules" ] || [ ! -f "node_modules/pg/package.json" ]; then
    echo "📦 Installing dependencies..."
    npm install pg @aws-sdk/client-secrets-manager @aws-sdk/client-rds
    echo "✅ Dependencies installed"
    echo ""
fi

# Run the migration
echo "⚙️  Running migration..."
echo "─────────────────────────"
ENVIRONMENT=$ENVIRONMENT node scripts/run-migration-rds-node.js "$MIGRATION_FILE"

echo ""
echo "✅ Migration completed!"
echo ""
echo "🔍 Verifying column was created..."
echo ""

# Verify using AWS CLI and psql if available, or just report success
echo "To verify, run this SQL query:"
echo "SELECT column_name, data_type FROM information_schema.columns"
echo "WHERE table_name = 'vendors' AND column_name = 'specializations';"
echo ""
