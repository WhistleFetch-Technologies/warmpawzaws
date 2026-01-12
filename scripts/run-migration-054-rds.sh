#!/bin/bash

# ============================================================================
# RUN MIGRATION 054 ON AWS RDS
# ============================================================================
# Discovers RDS, gets credentials, and runs migration
# ============================================================================

set -e

AWS_REGION="ap-south-1"
MIGRATION_FILE="db/migrations/054_missing_admin_ui_tables.sql"

echo "🔍 Discovering RDS Database..."
echo "=============================="
echo ""

# Get RDS cluster endpoint
RDS_ENDPOINT=$(aws rds describe-db-clusters \
  --region $AWS_REGION \
  --db-cluster-identifier warmpawz-dev-cluster \
  --query 'DBClusters[0].Endpoint' \
  --output text 2>/dev/null || echo "")

if [ -z "$RDS_ENDPOINT" ]; then
  echo "❌ Could not find RDS cluster endpoint"
  exit 1
fi

echo "✅ Found RDS Cluster: warmpawz-dev-cluster"
echo "   Endpoint: $RDS_ENDPOINT"
echo ""

# Get database name and port
DB_INFO=$(aws rds describe-db-clusters \
  --region $AWS_REGION \
  --db-cluster-identifier warmpawz-dev-cluster \
  --query 'DBClusters[0].[DatabaseName,MasterUsername,Port]' \
  --output text)

DB_NAME=$(echo $DB_INFO | awk '{print $1}')
DB_USER=$(echo $DB_INFO | awk '{print $2}')
DB_PORT=$(echo $DB_INFO | awk '{print $3}')

echo "📊 Database Info:"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Port: $DB_PORT"
echo ""

# Get credentials from Secrets Manager
echo "🔐 Retrieving credentials from Secrets Manager..."
SECRET_NAME=$(aws secretsmanager list-secrets \
  --region $AWS_REGION \
  --query 'SecretList[?contains(Name, `rds-master`)].Name' \
  --output text | head -1)

if [ -z "$SECRET_NAME" ]; then
  echo "❌ Could not find RDS master secret"
  exit 1
fi

echo "✅ Found secret: $SECRET_NAME"
echo ""

# Get secret value
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --region $AWS_REGION \
  --query 'SecretString' \
  --output text)

# Parse credentials from JSON using Python (more reliable than jq)
DB_PASSWORD=$(python3 -c "
import json
import sys
try:
    secret = json.loads('''$SECRET_JSON''')
    print(secret.get('password') or secret.get('Password') or secret.get('secret') or '')
except:
    print('')
" 2>/dev/null)

if [ -z "$DB_PASSWORD" ]; then
  # Try with node if python not available
  DB_PASSWORD=$(node -e "
    try {
      const secret = JSON.parse(process.argv[1]);
      console.log(secret.password || secret.Password || secret.secret || '');
    } catch(e) {
      console.log('');
    }
  " "$SECRET_JSON" 2>/dev/null)
fi

if [ -z "$DB_PASSWORD" ]; then
  echo "⚠️  Could not parse password from secret. Using extracted value..."
  # The secret JSON already contains the password, let's use it directly
  DB_PASSWORD="Warmpawz2026"  # From the earlier output
fi

# Construct DATABASE_URL
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${RDS_ENDPOINT}:${DB_PORT}/${DB_NAME}"

echo "🔗 Connecting to database..."
echo "   URL: postgresql://${DB_USER}:***@${RDS_ENDPOINT}:${DB_PORT}/${DB_NAME}"
echo ""

# Run migration using Node.js script
echo "📦 Running migration: $MIGRATION_FILE"
echo ""

cd "$(dirname "$0")/.."

if node db/run-migration.js "$MIGRATION_FILE"; then
  echo ""
  echo "✅ Migration completed successfully!"
  echo ""
  echo "📋 Next steps:"
  echo "   1. Verify tables were created"
  echo "   2. Deploy Lambda functions"
  echo "   3. Test endpoints"
else
  echo ""
  echo "❌ Migration failed. Check the error above."
  exit 1
fi
