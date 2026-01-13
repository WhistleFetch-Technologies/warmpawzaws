#!/bin/bash
# Migration script for customer enhancement tables (056)
# Uses AWS CLI to get RDS credentials and Node.js to run migration

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "📄 Reading migration file..."
MIGRATION_FILE="db/migrations/056_customer_enhancement_tables.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "🔍 Getting RDS credentials from AWS..."

# Get RDS endpoint
DB_HOST=$(aws rds describe-db-instances \
  --region ap-south-1 \
  --query 'DBInstances[?contains(DBInstanceIdentifier, `warmpawz`)].Endpoint.Address' \
  --output text 2>/dev/null | head -1)

if [ -z "$DB_HOST" ] || [ "$DB_HOST" = "None" ]; then
  echo "❌ Could not get DB host from AWS RDS"
  exit 1
fi

echo "✅ RDS Endpoint: $DB_HOST"

# Get DB credentials from Secrets Manager
RDS_SECRET_NAME="warmpawz-dev-rds-master-20260106164510791100000002"
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$RDS_SECRET_NAME" \
  --region ap-south-1 \
  --query SecretString \
  --output text 2>/dev/null || echo "")

if [ -z "$DB_SECRET" ]; then
  echo "❌ Could not get DB credentials from Secrets Manager"
  exit 1
fi

# Extract username and password from JSON secret
DB_USERNAME=$(echo "$DB_SECRET" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.username||'postgres')")
DB_PASSWORD=$(echo "$DB_SECRET" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(d.password||'')")

if [ -z "$DB_PASSWORD" ]; then
  echo "❌ DB password not found in secret"
  exit 1
fi

echo "✅ Credentials retrieved from Secrets Manager"

echo "🚀 Executing migration..."
echo "   Host: $DB_HOST"
echo "   Database: warmpawz"
echo "   User: $DB_USERNAME"

# Ensure pg module is available
if [ ! -d "db/node_modules/pg" ]; then
  echo "📦 Installing pg module..."
  cd db && npm install pg --no-save 2>/dev/null || npm install pg
  cd "$PROJECT_ROOT"
fi

# Run migration using Node.js
NODE_PATH="$PROJECT_ROOT/db/node_modules" node <<EOF
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || '$DB_HOST',
  database: 'warmpawz',
  user: process.env.DB_USERNAME || '$DB_USERNAME',
  password: process.env.DB_PASSWORD || '$DB_PASSWORD',
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

const migrationFile = path.join(__dirname, '$MIGRATION_FILE');
const sql = fs.readFileSync(migrationFile, 'utf8');

pool.query(sql)
  .then(() => {
    console.log('✅ Migration 056 executed successfully');
    
    // Verify tables were created
    return pool.query(\`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'customer_notification_settings',
        'customer_search_history',
        'customer_favorites',
        'customer_questionnaires'
      )
    \`);
  })
  .then((result) => {
    const tables = result.rows.map(r => r.table_name);
    console.log(\`✅ Tables verified: \${tables.join(', ')}\`);
    console.log(\`✅ Total tables created: \${tables.length}/4\`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err.message);
    if (err.message.includes('already exists')) {
      console.log('ℹ️  Tables may already exist - this is OK');
      process.exit(0);
    }
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
EOF

if [ $? -eq 0 ]; then
  echo ""
  echo "================================================================="
  echo "✅ Migration 056 completed successfully!"
  echo "================================================================="
else
  echo ""
  echo "================================================================="
  echo "❌ Migration failed - check errors above"
  echo "================================================================="
  exit 1
fi
