#!/bin/bash

# ============================================================================
# Direct RDS Migration Script
# ============================================================================
# Run this with your RDS connection details
# ============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Care Plans Migration - Direct RDS Connection${NC}"
echo "=================================================="
echo ""

# Get connection details
read -p "RDS Endpoint (hostname): " DB_HOST
read -p "Database Port [default: 5432]: " DB_PORT
DB_PORT=${DB_PORT:-5432}
read -p "Database Name: " DB_NAME
read -p "Database User: " DB_USER
read -sp "Database Password: " DB_PASSWORD
echo ""

MIGRATION_FILE="db/migrations/059_create_care_plans_tables.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Connecting to RDS and running migration...${NC}"
echo ""

# Test connection
export PGPASSWORD=$DB_PASSWORD
echo "Testing connection to $DB_HOST:$DB_PORT/$DB_NAME..."

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Connection successful${NC}"
    echo ""
    
    # Run migration
    echo "Running migration: $MIGRATION_FILE"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Migration completed successfully!${NC}"
        echo ""
        
        # Verify tables
        echo "Verifying tables created..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('pet_care_plans', 'care_plan_items', 'care_plan_templates');
        "
        
        # Verify templates
        TEMPLATE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM care_plan_templates;" | xargs)
        echo ""
        echo "Templates seeded: $TEMPLATE_COUNT (expected: 3)"
        
        if [ "$TEMPLATE_COUNT" -ge 3 ]; then
            echo -e "${GREEN}✅ Migration verification successful!${NC}"
        else
            echo -e "${YELLOW}⚠️  Warning: Expected 3 templates, found $TEMPLATE_COUNT${NC}"
        fi
    else
        echo -e "${RED}❌ Migration failed${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Connection failed. Please check:${NC}"
    echo "  - RDS endpoint is correct"
    echo "  - Security group allows your IP"
    echo "  - Credentials are correct"
    echo "  - Database exists"
    exit 1
fi

unset PGPASSWORD

echo ""
echo -e "${GREEN}🎉 Migration complete!${NC}"
