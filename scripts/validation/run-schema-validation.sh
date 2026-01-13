#!/bin/bash
# ============================================================================
# RUN PHASE 1: DATABASE SCHEMA VALIDATION
# ============================================================================

set -e

echo "🚀 Starting Database Schema Validation..."
echo "=========================================="

# Get database credentials from AWS Secrets Manager
echo "📥 Retrieving database credentials from Secrets Manager..."
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI" \
  --region ap-south-1 \
  --query SecretString \
  --output text)

# Extract credentials
export DB_USER=$(echo $SECRET_JSON | jq -r '.username')
export DB_PASSWORD=$(echo $SECRET_JSON | jq -r '.password')
export DB_HOST="warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com"
export DB_PORT="5432"
export DB_NAME="warmpawz"
export DB_SSL="true"

echo "✅ Database credentials retrieved"
echo "   Host: $DB_HOST"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"

# Test database connection
echo ""
echo "🔍 Testing database connection..."
PGPASSWORD=$DB_PASSWORD psql \
  -h $DB_HOST \
  -p $DB_PORT \
  -U $DB_USER \
  -d $DB_NAME \
  -c "SELECT NOW();" 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Database connection successful"
else
  echo "❌ Database connection failed"
  exit 1
fi

# Run schema validation
echo ""
echo "🔍 Running schema validation..."
cd "$(dirname "$0")"
npm install
npm run phase1

echo ""
echo "✅ Phase 1 validation complete!"
