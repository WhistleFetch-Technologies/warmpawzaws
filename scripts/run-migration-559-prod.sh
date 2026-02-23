#!/bin/bash
# ============================================================================
# Run Migration 559: Add specializations Column to Vendors Table (PRODUCTION)
# ============================================================================
# This script runs the migration on production RDS
# Best run from AWS CloudShell or EC2 instance in the VPC
# ============================================================================

set -e

ENVIRONMENT="prod"
REGION="ap-south-1"
MIGRATION_FILE="559_add_vendors_specializations_column.sql"

echo "🚀 Production Migration: Add specializations Column"
echo "===================================================="
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Migration: $MIGRATION_FILE"
echo ""

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Check if migration file exists
MIGRATION_PATH="db/migrations/$MIGRATION_FILE"
if [ ! -f "$MIGRATION_PATH" ]; then
    echo "❌ ERROR: Migration file not found: $MIGRATION_PATH"
    exit 1
fi

echo "✅ Migration file found: $MIGRATION_PATH"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "📦 Node.js not found. Installing..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Install dependencies if needed (in scripts directory)
cd "$SCRIPT_DIR"
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    echo "📦 Installing dependencies..."
    npm install pg @aws-sdk/client-secrets-manager
fi

# Run the migration
echo "⚙️  Running migration..."
echo "─────────────────────────"
cd "$PROJECT_ROOT"
ENVIRONMENT=$ENVIRONMENT node scripts/run-migration-rds-node.js $MIGRATION_FILE

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "🔍 Verifying migration..."
    echo "─────────────────────────"
    
    # Try to verify (if psql is available)
    if command -v psql &> /dev/null; then
        SECRET_NAME="warmpawz-prod-rds-master-20260207201049162400000001"
        SECRET_VALUE=$(aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --region "$REGION" --query 'SecretString' --output text 2>/dev/null || echo "")
        
        if [ -n "$SECRET_VALUE" ]; then
            DB_PASSWORD=$(echo "$SECRET_VALUE" | jq -r '.password // .Password // .secret // .Secret' 2>/dev/null || echo "")
            RDS_ENDPOINT=$(aws rds describe-db-clusters --db-cluster-identifier "warmpawz-prod-cluster" --region "$REGION" --query 'DBClusters[0].Endpoint' --output text 2>/dev/null || echo "")
            
            if [ -n "$DB_PASSWORD" ] && [ -n "$RDS_ENDPOINT" ]; then
                export PGPASSWORD="$DB_PASSWORD"
                psql -h "$RDS_ENDPOINT" -p 5432 -U warmpawz_admin -d warmpawz -c "
                    SELECT column_name, data_type, column_default 
                    FROM information_schema.columns 
                    WHERE table_name = 'vendors' AND column_name = 'specializations';
                " 2>/dev/null || echo "⚠️  Could not verify with psql (connection issue expected if not in VPC)"
            fi
        fi
    else
        echo "ℹ️  psql not available. Migration should be complete."
        echo "   Verify manually: SELECT column_name FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'specializations';"
    fi
    
    echo ""
    echo "🎉 Migration 559 completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Test the API endpoint: GET /vendor/facility/:vendorId"
    echo "   2. The error 'column specializations does not exist' should be resolved"
    echo ""
    exit 0
else
    echo ""
    echo "❌ Migration failed with exit code: $EXIT_CODE"
    echo ""
    echo "📋 Troubleshooting:"
    echo "   1. Check if you're running from AWS CloudShell or EC2 in the VPC"
    echo "   2. Verify AWS credentials have RDS and Secrets Manager access"
    echo "   3. Check CloudWatch logs if using Lambda"
    echo ""
    exit $EXIT_CODE
fi
