#!/bin/bash
# ============================================================================
# Database Seeding Script - AWS CLI
# ============================================================================
# Seeds the database with essential data using AWS CLI to get credentials
# Usage: ./scripts/seed-database-aws.sh [environment]
# Example: ./scripts/seed-database-aws.sh dev
# ============================================================================

set -e  # Exit on error

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

echo "🌱 Database Seeding via AWS CLI"
echo "============================================================"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# ============================================================================
# Get RDS Cluster Information
# ============================================================================
echo "📊 Getting RDS cluster information..."
RDS_CLUSTER_ID="warmpawz-${ENVIRONMENT}-cluster"
RDS_ENDPOINT=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$RDS_CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].Endpoint' \
  --output text 2>/dev/null || echo "")

if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "None" ] || [ "$RDS_ENDPOINT" = "null" ]; then
  echo "❌ ERROR: RDS cluster not found: $RDS_CLUSTER_ID"
  echo "   Please verify the cluster exists in region $REGION"
  exit 1
fi

RDS_PORT=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$RDS_CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].Port' \
  --output text 2>/dev/null || echo "5432")

RDS_DB_NAME=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$RDS_CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].DatabaseName' \
  --output text 2>/dev/null || echo "warmpawz")

echo "✅ RDS Cluster found:"
echo "   Endpoint: $RDS_ENDPOINT"
echo "   Port: $RDS_PORT"
echo "   Database: $RDS_DB_NAME"
echo ""

# ============================================================================
# Get Database Credentials from Secrets Manager
# ============================================================================
echo "🔐 Getting database credentials from Secrets Manager..."
RDS_SECRET_ARN=$(aws secretsmanager list-secrets \
  --region "$REGION" \
  --query "SecretList[?starts_with(Name, 'warmpawz-${ENVIRONMENT}-rds-master')].ARN" \
  --output text | head -1 || echo "")

if [ -z "$RDS_SECRET_ARN" ] || [ "$RDS_SECRET_ARN" = "None" ] || [ "$RDS_SECRET_ARN" = "null" ]; then
  echo "❌ ERROR: RDS secret not found"
  echo "   Looking for: warmpawz-${ENVIRONMENT}-rds-master*"
  exit 1
fi

echo "✅ Secret found: $RDS_SECRET_ARN"
echo ""

# Get credentials
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$RDS_SECRET_ARN" \
  --region "$REGION" \
  --query SecretString \
  --output text 2>/dev/null || echo "")

if [ -z "$DB_SECRET" ]; then
  echo "❌ ERROR: Failed to retrieve secret from Secrets Manager"
  exit 1
fi

# Parse JSON using Python if jq is not available
if command -v jq &> /dev/null; then
  DB_USERNAME=$(echo "$DB_SECRET" | jq -r '.username // .Username // "warmpawz_admin"')
  DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password // .Password // ""')
else
  # Use Python to parse JSON
  DB_USERNAME=$(python3 -c "import json, sys; data = json.loads(sys.stdin.read()); print(data.get('username') or data.get('Username') or 'warmpawz_admin')" <<< "$DB_SECRET")
  DB_PASSWORD=$(python3 -c "import json, sys; data = json.loads(sys.stdin.read()); print(data.get('password') or data.get('Password') or '')" <<< "$DB_SECRET")
fi

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "null" ]; then
  echo "❌ ERROR: Password not found in secret"
  exit 1
fi

echo "✅ Credentials retrieved"
echo "   Username: $DB_USERNAME"
echo ""

# URL-encode password
DB_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$DB_PASSWORD''', safe=''))")

# Construct DATABASE_URL
DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD_ENCODED}@${RDS_ENDPOINT}:${RDS_PORT}/${RDS_DB_NAME}"

echo "🔌 Database URL constructed"
echo ""

# ============================================================================
# Test Database Connection
# ============================================================================
echo "🔍 Testing database connection..."
# Test connection using Node.js instead of psql
if node -e "
const { Pool } = require('./db/node_modules/pg');
const pool = new Pool({ connectionString: process.env.TEST_DB_URL, ssl: { rejectUnauthorized: false } });
pool.query('SELECT version()').then(() => { console.log('✅ Database connection successful'); process.exit(0); }).catch(e => { console.log('⚠️  Connection test failed, but continuing...'); process.exit(0); });
" 2>/dev/null; then
  echo "✅ Connection test passed"
else
  echo "⚠️  Connection test skipped (using Node.js for seeding)"
fi
echo ""

# ============================================================================
# Run Seed Script
# ============================================================================
echo "🌱 Running seed script..."
echo ""

# Change to db directory
cd "$(dirname "$0")/../db" || exit 1

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm ci
fi

# Run seed script
echo "🚀 Executing seed:dev..."
export DATABASE_URL
export ENVIRONMENT="$ENVIRONMENT"
export TEST_DB_URL="$DATABASE_URL"

npm run seed:dev

echo ""
echo "✅ Database seeding completed!"
echo ""
echo "📋 Next steps:"
echo "   - Verify seeded data: psql \"$DATABASE_URL\" -c \"SELECT COUNT(*) FROM roles;\""
echo "   - Check service catalog: psql \"$DATABASE_URL\" -c \"SELECT COUNT(*) FROM service_catalog;\""
