#!/bin/bash
# ============================================================================
# Verify Behavior Journal Table Schema
# ============================================================================
# Checks the database schema for behavior_journal table to identify UUID issues
# Usage: ./scripts/verify-behavior-journal-schema.sh [environment]
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

echo "🔍 Verifying Behavior Journal Table Schema"
echo "============================================================"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo ""

# Get RDS info
RDS_CLUSTER_ID="warmpawz-${ENVIRONMENT}-cluster"
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

echo "✅ RDS Information:"
echo "   Endpoint: $RDS_ENDPOINT"
echo "   Port: $RDS_PORT"
echo "   Database: $RDS_DB_NAME"
echo ""

# Get credentials
echo "🔐 Getting credentials..."
SECRET_NAME=$(aws secretsmanager list-secrets \
  --region "$REGION" \
  --query "SecretList[?starts_with(Name, 'warmpawz-${ENVIRONMENT}-rds-master')].Name" \
  --output text | head -1)

if [ -z "$SECRET_NAME" ]; then
  echo "⚠️  Secret not found, trying alternative..."
  SECRET_NAME=$(aws secretsmanager list-secrets \
    --region "$REGION" \
    --query "SecretList[?contains(Name, 'rds-master')].Name" \
    --output text | head -1)
fi

if [ -z "$SECRET_NAME" ]; then
  echo "❌ ERROR: Could not find RDS secret"
  exit 1
fi

DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --region "$REGION" \
  --query SecretString \
  --output text)

# Parse credentials
if command -v jq &> /dev/null; then
  DB_USERNAME=$(echo "$DB_SECRET" | jq -r '.username // .Username // "warmpawz_admin"')
  DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password // .Password')
else
  DB_USERNAME=$(python3 -c "import json, sys; data = json.loads(sys.stdin.read()); print(data.get('username') or data.get('Username') or 'warmpawz_admin')" <<< "$DB_SECRET")
  DB_PASSWORD=$(python3 -c "import json, sys; data = json.loads(sys.stdin.read()); print(data.get('password') or data.get('Password') or '')" <<< "$DB_SECRET")
fi

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "null" ]; then
  echo "⚠️  Password not found, please enter:"
  read -s DB_PASSWORD
  echo ""
fi

echo "✅ Credentials retrieved"
echo ""

# Create Node.js script to verify schema
cd "$(dirname "$0")/.."

cat > /tmp/verify-schema.js << 'NODE_SCRIPT'
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

async function verifySchema() {
  const client = await pool.connect();
  try {
    console.log('📊 Checking if table exists...');
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'behavior_journal'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ Table behavior_journal does not exist!');
      process.exit(1);
    }
    
    console.log('✅ Table exists');
    console.log('');
    
    console.log('📋 Column Information:');
    const columns = await client.query(`
      SELECT 
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'behavior_journal'
      ORDER BY ordinal_position
    `);
    
    console.table(columns.rows);
    console.log('');
    
    console.log('🔗 Foreign Key Constraints:');
    const foreignKeys = await client.query(`
      SELECT 
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'behavior_journal'
        AND tc.constraint_type = 'FOREIGN KEY'
    `);
    
    if (foreignKeys.rows.length > 0) {
      console.table(foreignKeys.rows);
    } else {
      console.log('   No foreign key constraints found');
    }
    console.log('');
    
    console.log('📇 Indexes:');
    const indexes = await client.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'behavior_journal'
      ORDER BY indexname
    `);
    
    if (indexes.rows.length > 0) {
      console.table(indexes.rows);
    } else {
      console.log('   No indexes found');
    }
    console.log('');
    
    console.log('🧪 Testing UUID queries...');
    
    // Test 1: Simple SELECT
    try {
      const test1 = await client.query('SELECT COUNT(*) FROM behavior_journal');
      console.log('✅ Test 1: Simple SELECT - PASSED');
      console.log(`   Rows: ${test1.rows[0].count}`);
    } catch (err) {
      console.log('❌ Test 1: Simple SELECT - FAILED');
      console.log(`   Error: ${err.message}`);
    }
    
    // Test 2: SELECT with UUID filter (using text cast)
    try {
      const test2 = await client.query(`
        SELECT * FROM behavior_journal 
        WHERE CAST(pet_id AS TEXT) = CAST($1 AS TEXT) 
        LIMIT 1
      `, ['00000000-0000-0000-0000-000000000000']);
      console.log('✅ Test 2: UUID filter with CAST - PASSED');
    } catch (err) {
      console.log('❌ Test 2: UUID filter with CAST - FAILED');
      console.log(`   Error: ${err.message}`);
    }
    
    // Test 3: SELECT with UUID filter (direct)
    try {
      const test3 = await client.query(`
        SELECT * FROM behavior_journal 
        WHERE pet_id = $1::uuid 
        LIMIT 1
      `, ['00000000-0000-0000-0000-000000000000']);
      console.log('✅ Test 3: UUID filter direct - PASSED');
    } catch (err) {
      console.log('❌ Test 3: UUID filter direct - FAILED');
      console.log(`   Error: ${err.message}`);
    }
    
    // Test 4: JOIN with pets table
    try {
      const test4 = await client.query(`
        SELECT bj.*, p.name 
        FROM behavior_journal bj
        LEFT JOIN pets p ON CAST(bj.pet_id AS TEXT) = CAST(p.id AS TEXT)
        LIMIT 1
      `);
      console.log('✅ Test 4: JOIN with CAST - PASSED');
    } catch (err) {
      console.log('❌ Test 4: JOIN with CAST - FAILED');
      console.log(`   Error: ${err.message}`);
    }
    
    // Test 5: JOIN with pets table (direct UUID)
    try {
      const test5 = await client.query(`
        SELECT bj.*, p.name 
        FROM behavior_journal bj
        LEFT JOIN pets p ON bj.pet_id = p.id
        LIMIT 1
      `);
      console.log('✅ Test 5: JOIN direct UUID - PASSED');
    } catch (err) {
      console.log('❌ Test 5: JOIN direct UUID - FAILED');
      console.log(`   Error: ${err.message}`);
    }
    
    console.log('');
    console.log('✅ Schema verification complete!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

verifySchema().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
NODE_SCRIPT

# Install pg if needed
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT/db"
if [ ! -d "node_modules" ] || [ ! -d "node_modules/pg" ]; then
  echo "📦 Installing dependencies..."
  npm install pg > /dev/null 2>&1 || npm install > /dev/null 2>&1
fi

# Run verification with NODE_PATH set to find pg module
echo "🔍 Running schema verification..."
cd "$PROJECT_ROOT"
DB_HOST="$RDS_ENDPOINT" \
DB_PORT="$RDS_PORT" \
DB_NAME="$RDS_DB_NAME" \
DB_USER="$DB_USERNAME" \
DB_PASSWORD="$DB_PASSWORD" \
NODE_PATH="$PROJECT_ROOT/db/node_modules" \
node /tmp/verify-schema.js

rm -f /tmp/verify-schema.js

echo ""
echo "✅ Verification complete!"
