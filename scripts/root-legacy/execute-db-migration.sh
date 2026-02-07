#!/bin/bash
# ============================================================================
# Execute Database Migration - Create problem_grid_mappings Table
# ============================================================================
# This script creates the problem_grid_mappings table in the database
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Database Migration - problem_grid_mappings Table      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  psql not found. Please install PostgreSQL client.${NC}"
    echo ""
    echo "Alternative: Run the SQL script directly in your database client:"
    echo "  File: create-problem-grid-table.sql"
    echo ""
    read -p "Do you want to continue with manual instructions? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        exit 0
    fi
    echo ""
    echo -e "${BLUE}Manual Instructions:${NC}"
    echo "1. Connect to your RDS database"
    echo "2. Run: create-problem-grid-table.sql"
    echo "3. Verify: SELECT COUNT(*) FROM problem_grid_mappings;"
    exit 0
fi

# Get database connection details
echo -e "${BLUE}📋 Database Connection${NC}"
echo "────────────────────────────────────────────────────────────"

# Try to get from environment or ask user
DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-}"
DB_USER="${DB_USER:-}"

if [ -z "$DB_HOST" ]; then
    echo -e "${YELLOW}Database connection details not found in environment.${NC}"
    echo ""
    read -p "Enter RDS Host (e.g., warmpawz-db.xxxxx.ap-south-1.rds.amazonaws.com): " DB_HOST
    read -p "Enter Database Name (default: postgres): " DB_NAME
    DB_NAME="${DB_NAME:-postgres}"
    read -p "Enter Database User: " DB_USER
    read -sp "Enter Database Password: " DB_PASSWORD
    echo ""
else
    echo -e "${GREEN}Using environment variables for database connection${NC}"
    DB_PASSWORD="${DB_PASSWORD:-}"
    if [ -z "$DB_PASSWORD" ]; then
        read -sp "Enter Database Password: " DB_PASSWORD
        echo ""
    fi
fi

# Export password for psql
export PGPASSWORD="$DB_PASSWORD"

echo ""
echo -e "${BLUE}🔍 Testing database connection...${NC}"
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo "Please check your credentials and try again."
    exit 1
fi

echo ""
echo -e "${BLUE}📦 Creating problem_grid_mappings table...${NC}"
echo "────────────────────────────────────────────────────────────"

# Execute SQL script
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f create-problem-grid-table.sql; then
    echo -e "${GREEN}✅ Table created successfully${NC}"
else
    echo -e "${RED}❌ Table creation failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔍 Verifying table creation...${NC}"
echo "────────────────────────────────────────────────────────────"

# Verify table exists
TABLE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'problem_grid_mappings');" | xargs)

if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${GREEN}✅ Table exists${NC}"
else
    echo -e "${RED}❌ Table not found${NC}"
    exit 1
fi

# Count records
RECORD_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM problem_grid_mappings;" | xargs)

echo -e "${GREEN}✅ Records inserted: $RECORD_COUNT${NC}"

# Show sample data
echo ""
echo -e "${BLUE}📊 Sample Data:${NC}"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT problem_id, problem_name, role_id, order_index FROM problem_grid_mappings ORDER BY order_index LIMIT 5;"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ DATABASE MIGRATION COMPLETE                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Test API endpoint: /customer/vendors/by-problem"
echo "  2. Test in browser: Navigate to problem grid"
echo "  3. Verify vendors appear for selected problems"
echo ""

# Clean up
unset PGPASSWORD
