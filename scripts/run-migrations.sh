#!/bin/bash

# ============================================================================
# RUN ROLE ARCHITECTURE MIGRATIONS
# ============================================================================
# This script runs the two migrations for role architecture enhancement:
# 1. Migration 139: Add customer_service column
# 2. Migration 140: Role consolidation (20 → 21 roles)
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Role Architecture Migrations${NC}"
echo ""

# Check if DB_CONNECTION_STRING is set
if [ -z "$DB_CONNECTION_STRING" ]; then
    echo -e "${YELLOW}⚠️  DB_CONNECTION_STRING not set${NC}"
    echo "Please set it:"
    echo "  export DB_CONNECTION_STRING='postgresql://user:pass@host:port/dbname'"
    echo ""
    echo "Or provide it as argument:"
    echo "  ./scripts/run-migrations.sh 'postgresql://user:pass@host:port/dbname'"
    echo ""
    
    if [ -n "$1" ]; then
        DB_CONNECTION_STRING="$1"
        echo -e "${GREEN}✅ Using connection string from argument${NC}"
    else
        echo -e "${RED}❌ No connection string provided. Exiting.${NC}"
        exit 1
    fi
fi

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql not found. Please install PostgreSQL client.${NC}"
    exit 1
fi

echo -e "${GREEN}📋 Migration Plan:${NC}"
echo "  1. Migration 139: Add customer_service column and indexes"
echo "  2. Migration 140: Role consolidation (20 → 21 roles)"
echo ""

# Confirm before proceeding
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Migration cancelled${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}📦 Running Migration 139...${NC}"
echo "----------------------------------------"
PGPASSWORD=$(echo $DB_CONNECTION_STRING | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
psql "$DB_CONNECTION_STRING" -f db/migrations/139_add_customer_service_to_roles.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration 139 completed successfully${NC}"
else
    echo -e "${RED}❌ Migration 139 failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}📦 Running Migration 140...${NC}"
echo "----------------------------------------"
PGPASSWORD=$(echo $DB_CONNECTION_STRING | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p') \
psql "$DB_CONNECTION_STRING" -f db/migrations/140_role_consolidation_20_to_21.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration 140 completed successfully${NC}"
else
    echo -e "${RED}❌ Migration 140 failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All migrations completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "  1. Verify roles table has customer_service column"
echo "  2. Check that roles are consolidated (21 roles total)"
echo "  3. Verify role configs have vendorConfiguration and serviceStyles"
echo "  4. Test admin UI role configuration wizard"
echo "  5. Test vendor onboarding with new roles"
echo ""
