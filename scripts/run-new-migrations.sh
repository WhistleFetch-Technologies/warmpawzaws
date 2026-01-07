#!/bin/bash
# ============================================================================
# Run New Migrations (050 & 051) and Test
# ============================================================================
# Runs migrations 050 (form schemas) and 051 (permissions) and verifies them
# ============================================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Running New Migrations (050 & 051)${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  # Try to construct from individual components
  if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set. Checking for Docker Compose...${NC}"
    
    # Check if docker-compose is available and postgres is running
    if command -v docker-compose &> /dev/null; then
      if docker-compose ps postgres | grep -q "Up"; then
        echo -e "${GREEN}✅ Docker Compose postgres is running${NC}"
        export DATABASE_URL="postgresql://warmpawz:warmpawz@localhost:5432/warmpawz"
        echo -e "${BLUE}Using Docker Compose database: ${DATABASE_URL}${NC}"
      else
        echo -e "${YELLOW}Starting Docker Compose postgres...${NC}"
        docker-compose up -d postgres
        sleep 5
        export DATABASE_URL="postgresql://warmpawz:warmpawz@localhost:5432/warmpawz"
      fi
    else
      echo -e "${RED}❌ ERROR: DATABASE_URL or DB_* variables not set${NC}"
      echo ""
      echo "Please set one of:"
      echo "  1. DATABASE_URL=postgresql://user:pass@host:port/db"
      echo "  2. DB_HOST, DB_NAME, DB_USER, DB_PASSWORD"
      echo ""
      exit 1
    fi
  else
    # Construct DATABASE_URL from components
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}"
  fi
fi

echo -e "${GREEN}✅ Database URL configured${NC}"
echo ""

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}Step 1: Testing database connection...${NC}"

# Test connection using node from db directory
cd "$PROJECT_ROOT/db"
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT 1')
  .then(() => {
    console.log('✅ Database connection successful');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  });
" || exit 1
cd "$PROJECT_ROOT"

echo ""

# Check if migrations directory exists
MIGRATIONS_DIR="$PROJECT_ROOT/db/migrations"
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo -e "${RED}❌ Migrations directory not found: $MIGRATIONS_DIR${NC}"
  exit 1
fi

echo -e "${BLUE}Step 2: Running Migration 050 (Complete Form Schemas)...${NC}"

cd "$PROJECT_ROOT/db"
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationFile = path.join('$MIGRATIONS_DIR', '050_complete_role_form_schemas.sql');
const sql = fs.readFileSync(migrationFile, 'utf8');

pool.query(sql)
  .then(() => {
    console.log('✅ Migration 050 completed successfully');
    return pool.end();
  })
  .catch(err => {
    console.error('❌ Migration 050 failed:', err.message);
    process.exit(1);
  });
" || exit 1
cd "$PROJECT_ROOT"

echo ""

echo -e "${BLUE}Step 3: Running Migration 051 (Role Permissions)...${NC}"

cd "$PROJECT_ROOT/db"
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationFile = path.join('$MIGRATIONS_DIR', '051_seed_role_permissions.sql');
const sql = fs.readFileSync(migrationFile, 'utf8');

pool.query(sql)
  .then(() => {
    console.log('✅ Migration 051 completed successfully');
    return pool.end();
  })
  .catch(err => {
    console.error('❌ Migration 051 failed:', err.message);
    process.exit(1);
  });
" || exit 1
cd "$PROJECT_ROOT"

echo ""

echo -e "${BLUE}Step 4: Verifying migrations...${NC}"

# Run verification queries
cd "$PROJECT_ROOT/db"
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verify() {
  try {
    // Check roles with schemas
    const schemaResult = await pool.query(\`
      SELECT 
        name,
        jsonb_array_length(config->'onboardingFields'->'fields') as field_count
      FROM roles 
      WHERE is_active = true
      ORDER BY name
    \`);
    
    console.log('\\n📋 Form Schemas:');
    const rolesWithSchemas = schemaResult.rows.filter(r => r.field_count > 0);
    console.log(\`   ✅ \${rolesWithSchemas.length}/20 roles have form schemas\`);
    
    if (rolesWithSchemas.length < 20) {
      const missing = schemaResult.rows.filter(r => r.field_count === 0 || !r.field_count);
      console.log('   ⚠️  Roles missing schemas:');
      missing.forEach(r => console.log(\`      - \${r.name}\`));
    }
    
    // Check permissions
    const permResult = await pool.query(\`
      SELECT 
        r.name,
        COUNT(rp.id) as permission_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      WHERE r.is_active = true
      GROUP BY r.id, r.name
      ORDER BY r.name
    \`);
    
    console.log('\\n🔐 Role Permissions:');
    const rolesWithPerms = permResult.rows.filter(r => r.permission_count > 0);
    console.log(\`   ✅ \${rolesWithPerms.length}/20 roles have permissions\`);
    
    if (rolesWithPerms.length < 20) {
      const missing = permResult.rows.filter(r => r.permission_count === 0);
      console.log('   ⚠️  Roles missing permissions:');
      missing.forEach(r => console.log(\`      - \${r.name}\`));
    }
    
    // Summary
    console.log('\\n📊 Summary:');
    if (rolesWithSchemas.length === 20 && rolesWithPerms.length === 20) {
      console.log('   ✅ All 20 roles have complete schemas and permissions!');
      process.exit(0);
    } else {
      console.log('   ⚠️  Some roles are missing schemas or permissions');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verify();
" || exit 1
cd "$PROJECT_ROOT"

echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}✅ Migrations completed and verified successfully!${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""

