#!/bin/bash

# ============================================================================
# Run Migration on AWS RDS PostgreSQL
# ============================================================================
# This script connects to AWS RDS and runs the care plans migration
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Running Care Plans Migration on AWS RDS${NC}"
echo "=============================================="
echo ""

# Get stage (dev/staging/prod)
read -p "Enter stage (dev/staging/prod) [default: dev]: " STAGE
STAGE=${STAGE:-dev}

echo "Fetching RDS connection details from SSM..."
echo ""

# Get connection details from SSM
DB_HOST=$(aws ssm get-parameter --name "/warmpawz/${STAGE}/db/host" --query Parameter.Value --output text 2>/dev/null || echo "")
DB_PORT=$(aws ssm get-parameter --name "/warmpawz/${STAGE}/db/port" --query Parameter.Value --output text 2>/dev/null || echo "5432")
DB_NAME=$(aws ssm get-parameter --name "/warmpawz/${STAGE}/db/name" --query Parameter.Value --output text 2>/dev/null || echo "")
DB_USER=$(aws ssm get-parameter --name "/warmpawz/${STAGE}/db/user" --query Parameter.Value --output text 2>/dev/null || echo "")

if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
    echo -e "${RED}❌ Failed to get database connection details from SSM${NC}"
    echo ""
    echo "Please provide connection details manually:"
    read -p "RDS Endpoint (hostname): " DB_HOST
    read -p "Database Name: " DB_NAME
    read -p "Database User: " DB_USER
    read -sp "Database Password: " DB_PASSWORD
    echo ""
    read -p "Database Port [default: 5432]: " DB_PORT
    DB_PORT=${DB_PORT:-5432}
else
    echo -e "${GREEN}✅ Retrieved connection details from SSM${NC}"
    echo "  Host: $DB_HOST"
    echo "  Port: $DB_PORT"
    echo "  Database: $DB_NAME"
    echo "  User: $DB_USER"
    echo ""
    read -sp "Database Password (from SSM or manual): " DB_PASSWORD
    echo ""
fi

# Migration file path
MIGRATION_FILE="db/migrations/059_create_care_plans_tables.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Connecting to RDS and running migration...${NC}"
echo ""

# Set password and run migration
export PGPASSWORD=$DB_PASSWORD

# Test connection first
echo "Testing connection..."
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
        
        # Verify tables created
        echo "Verifying tables..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('pet_care_plans', 'care_plan_items', 'care_plan_templates');
        "
        
        # Verify templates seeded
        TEMPLATE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM care_plan_templates;")
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

# Clear password
unset PGPASSWORD

echo ""
echo -e "${GREEN}🎉 Migration complete! You can now deploy the backend.${NC}"
