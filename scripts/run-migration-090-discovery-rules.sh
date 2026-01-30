#!/bin/bash
# ============================================================================
# Run Migration 090: Discovery Rules (Rule Engine)
# ============================================================================
# Creates discovery_rules table and seeds default rules.
# Usage:
#   DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/run-migration-090-discovery-rules.sh
#   # Or with AWS RDS (Secrets Manager):
#   ENVIRONMENT=dev node scripts/run-migration-rds-node.js 090_discovery_rules.sql
# ============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATION_FILE="$PROJECT_ROOT/db/migrations/090_discovery_rules.sql"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Migration 090: Discovery Rules (Rule Engine)"
echo "============================================"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}Migration file not found: $MIGRATION_FILE${NC}"
  exit 1
fi

# Option A: AWS RDS (Secrets Manager) – run the generic node runner with 090.
# Note: run-migration-rds-node.js verification is for migration 053; ignore that and check discovery_rules manually.
if [ -n "$USE_AWS_RDS" ] || [ -n "$ENVIRONMENT" ]; then
  ENV="${ENVIRONMENT:-dev}"
  echo -e "${YELLOW}Using AWS RDS (ENVIRONMENT=$ENV). Running migration...${NC}"
  cd "$PROJECT_ROOT"
  node scripts/run-migration-rds-node.js 090_discovery_rules.sql || true
  echo -e "${GREEN}If no error above, verify with: SELECT COUNT(*) FROM discovery_rules;${NC}"
  exit 0
fi

# Option B: DATABASE_URL or DB_* 
if [ -z "$DATABASE_URL" ]; then
  if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
    echo -e "${YELLOW}Set DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD${NC}"
    echo "Example: DATABASE_URL=postgresql://user:pass@host:5432/db $0"
    echo "Or: ENVIRONMENT=dev node scripts/run-migration-rds-node.js 090_discovery_rules.sql"
    exit 1
  fi
  export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}"
fi

echo "Running migration..."
cd "$PROJECT_ROOT"
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync('$MIGRATION_FILE', 'utf8');
pool.query(sql)
  .then(() => pool.query('SELECT COUNT(*) AS n FROM discovery_rules'))
  .then((r) => {
    console.log('✅ Migration 090 completed. Rows in discovery_rules:', r.rows[0].n);
    return pool.end();
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  });
"
echo -e "${GREEN}Step 1 (migration) complete.${NC}"
