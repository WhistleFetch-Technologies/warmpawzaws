#!/bin/bash
# ============================================================================
# Run Admin Endpoints Migration on AWS RDS
# ============================================================================
# Connects to AWS RDS cluster and runs the migration script
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

echo "🚀 Admin Endpoints Migration - AWS RDS"
echo "========================================"
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
  
  # Try using Node.js instead
  echo "📦 Using Node.js to run migration..."
  cd "$(dirname "$0")/.."
  
  node -e "
    const { Pool } = require('pg');
    const fs = require('fs');
    const pool = new Pool({
      host: process.env.PGHOST,
      port: process.env.PGPORT,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: { rejectUnauthorized: false }
    });
    
    const sql = fs.readFileSync('db/migrations/053_admin_endpoints_tables.sql', 'utf8');
    
    pool.query(sql)
      .then(() => {
        console.log('✅ Migration completed successfully!');
        return pool.query(\`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN (
            'support_tickets', 
            'chat_sessions', 
            'transactions', 
            'vendor_payment_rules', 
            'vendor_refund_tiers',
            'vendor_support_requests',
            'compliance_issues'
          )
          ORDER BY table_name
        \`);
      })
      .then((result) => {
        console.log('');
        console.log('✅ Created tables:');
        result.rows.forEach(row => console.log('   -', row.table_name));
        process.exit(0);
      })
      .catch((err) => {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
      });
  "
  exit $?
fi

echo ""
echo "⚙️  Running migration..."
echo "─────────────────────────"

# Run migration
psql -f db/migrations/053_admin_endpoints_tables.sql

echo ""
echo "✅ Migration completed!"
echo ""

# Verify tables
echo "🔍 Verifying created tables..."
psql -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'support_tickets', 
  'chat_sessions', 
  'transactions', 
  'vendor_payment_rules', 
  'vendor_refund_tiers',
  'vendor_support_requests',
  'compliance_issues'
)
ORDER BY table_name;
"

echo ""
echo "🎉 Migration and verification complete!"
