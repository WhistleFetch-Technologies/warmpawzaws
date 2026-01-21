#!/bin/bash
# ============================================================================
# Run Role Architecture Migrations on AWS RDS
# ============================================================================
# Connects to AWS RDS cluster and runs migrations 139 and 140
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

echo "🚀 Role Architecture Migrations - AWS RDS"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Get RDS cluster info
RDS_CLUSTER_ID="warmpawz-${ENVIRONMENT}-cluster"
echo "📊 Getting RDS cluster information..."

RDS_ENDPOINT=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$RDS_CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].Endpoint' \
  --output text 2>/dev/null || echo "")

if [ -z "$RDS_ENDPOINT" ] || [ "$RDS_ENDPOINT" = "None" ] || [ "$RDS_ENDPOINT" = "null" ]; then
  echo "❌ ERROR: RDS cluster not found: $RDS_CLUSTER_ID"
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

RDS_USERNAME=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$RDS_CLUSTER_ID" \
  --region "$REGION" \
  --query 'DBClusters[0].MasterUsername' \
  --output text 2>/dev/null || echo "warmpawz_admin")

echo "✅ RDS Cluster found:"
echo "   Endpoint: $RDS_ENDPOINT"
echo "   Port: $RDS_PORT"
echo "   Database: $RDS_DB_NAME"
echo "   Username: $RDS_USERNAME"
echo ""

# Get password from Secrets Manager
echo "🔐 Getting database credentials from Secrets Manager..."

# Try to find the RDS secret
SECRET_NAME=$(aws secretsmanager list-secrets \
  --region "$REGION" \
  --query "SecretList[?contains(Name, 'rds-master') || contains(Name, 'rds-master')].Name" \
  --output text | grep -i "rds-master" | head -1)

if [ -z "$SECRET_NAME" ]; then
  # Try specific secret name pattern
  SECRET_NAME="warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002"
  if ! aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" &>/dev/null; then
    # Try to find any secret with rds-master
    SECRET_NAME=$(aws secretsmanager list-secrets \
      --region "$REGION" \
      --query "SecretList[?contains(Name, 'rds-master')].Name" \
      --output text | head -1)
  fi
fi

if [ -z "$SECRET_NAME" ]; then
  echo "⚠️  Secret not found automatically. Please enter database password:"
  read -s RDS_PASSWORD
else
  echo "✅ Found secret: $SECRET_NAME"
  SECRET_VALUE=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_NAME" \
    --region "$REGION" \
    --query 'SecretString' \
    --output text)
  
  # Parse JSON secret
  RDS_PASSWORD=$(echo "$SECRET_VALUE" | grep -o '"password"[^,}]*' | cut -d'"' -f4 || echo "$SECRET_VALUE")
  
  # If password not in JSON format, try direct value
  if [ -z "$RDS_PASSWORD" ] || [ "$RDS_PASSWORD" = "null" ]; then
    RDS_PASSWORD="$SECRET_VALUE"
  fi
fi

if [ -z "$RDS_PASSWORD" ]; then
  echo "❌ ERROR: Could not retrieve database password"
  exit 1
fi

echo "✅ Credentials retrieved"
echo ""

# Build connection string
export PGHOST="$RDS_ENDPOINT"
export PGPORT="$RDS_PORT"
export PGDATABASE="$RDS_DB_NAME"
export PGUSER="$RDS_USERNAME"
export PGPASSWORD="$RDS_PASSWORD"

# Test connection
echo "🔗 Testing database connection..."
if psql -c "SELECT 1;" &>/dev/null; then
  echo "✅ Connection successful"
else
  echo "❌ Connection failed. Checking if psql is available..."
  echo "   Trying Node.js method..."
  
  # Use Node.js if psql not available
  cd "$(dirname "$0")/.."
  
  node -e "
    const { Pool } = require('pg');
    const fs = require('fs');
    const path = require('path');
    
    const pool = new Pool({
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: { rejectUnauthorized: false }
    });
    
    async function runMigrations() {
      try {
        // Migration 139
        console.log('📦 Running Migration 139...');
        const sql139 = fs.readFileSync('db/migrations/139_add_customer_service_to_roles.sql', 'utf8');
        await pool.query(sql139);
        console.log('✅ Migration 139 completed');
        
        // Migration 140
        console.log('📦 Running Migration 140...');
        const sql140 = fs.readFileSync('db/migrations/140_role_consolidation_20_to_21.sql', 'utf8');
        await pool.query(sql140);
        console.log('✅ Migration 140 completed');
        
        console.log('');
        console.log('✅ All migrations completed successfully!');
        process.exit(0);
      } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
      } finally {
        await pool.end();
      }
    }
    
    runMigrations();
  "
  exit $?
fi

echo ""
echo "⚙️  Running Migration 139: Add customer_service column..."
echo "─────────────────────────────────────────────────────────"
psql -f db/migrations/139_add_customer_service_to_roles.sql

echo ""
echo "⚙️  Running Migration 140: Role consolidation..."
echo "─────────────────────────────────────────────────"
psql -f db/migrations/140_role_consolidation_20_to_21.sql

echo ""
echo "✅ All migrations completed!"
echo ""

# Verify migrations
echo "🔍 Verifying migrations..."
psql -c "
SELECT 
  COUNT(*) as total_roles,
  COUNT(customer_service) as roles_with_customer_service,
  COUNT(CASE WHEN config->>'vendorConfiguration' IS NOT NULL THEN 1 END) as roles_with_vendor_config
FROM roles 
WHERE isActive = true;
"

echo ""
echo "🎉 Migration and verification complete!"
