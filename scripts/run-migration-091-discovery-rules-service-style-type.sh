#!/bin/bash
# ============================================================================
# Run Migration 091: Discovery Rules – service_style and service_type
# ============================================================================
# Adds service_style and service_type columns to discovery_rules and updates
# the unique constraint. Requires migration 090 to have been run first.
# Usage:
#   DATABASE_URL=postgresql://user:pass@host:5432/db ./scripts/run-migration-091-discovery-rules-service-style-type.sh
#   # Or with AWS RDS (Secrets Manager):
#   ENVIRONMENT=dev node scripts/run-migration-rds-node.js 091_discovery_rules_service_style_type.sql
# ============================================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATION_FILE="$PROJECT_ROOT/db/migrations/091_discovery_rules_service_style_type.sql"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Migration 091: Discovery Rules – service_style & service_type"
echo "=============================================================="

if [ ! -f "$MIGRATION_FILE" ]; then
  echo -e "${RED}Migration file not found: $MIGRATION_FILE${NC}"
  exit 1
fi

# Option A: AWS RDS (Secrets Manager) – run the generic node runner with 091.
if [ -n "$USE_AWS_RDS" ] || [ -n "$ENVIRONMENT" ]; then
  ENV="${ENVIRONMENT:-dev}"
  echo -e "${YELLOW}Using AWS RDS (ENVIRONMENT=$ENV). Running migration...${NC}"
  cd "$PROJECT_ROOT"
  node scripts/run-migration-rds-node.js 091_discovery_rules_service_style_type.sql || true
  echo -e "${GREEN}If no error above, verify with: \\d discovery_rules (should show service_style, service_type)${NC}"
  exit 0
fi

# Option B: DATABASE_URL or DB_*
if [ -z "$DATABASE_URL" ]; then
  if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
    echo -e "${YELLOW}Set DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD${NC}"
    echo "Example: DATABASE_URL=postgresql://user:pass@host:5432/db $0"
    echo "Or: ENVIRONMENT=dev node scripts/run-migration-rds-node.js 091_discovery_rules_service_style_type.sql"
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
  .then(() => pool.query(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'discovery_rules' AND column_name IN ('service_style', 'service_type')\"))
  .then((r) => {
    console.log('✅ Migration 091 completed. New columns:', r.rows.length >= 2 ? 'service_style, service_type' : r.rows.map(x => x.column_name).join(', '));
    return pool.end();
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  });
"
echo -e "${GREEN}Migration 091 complete.${NC}"
