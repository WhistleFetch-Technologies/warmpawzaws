#!/bin/bash

# ============================================================================
# Run Migration 503: Add Diagnostic Tests Columns
# ============================================================================
# Adds missing test_code and other columns to diagnostic_tests table
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}Migration 503: Diagnostic Tests Columns${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# Migration file path
MIGRATION_FILE="db/migrations/503_add_diagnostic_tests_columns.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    echo "   Please ensure you're running this from the project root directory"
    exit 1
fi

echo -e "${GREEN}✅ Migration file found: $MIGRATION_FILE${NC}"
echo ""

# Get stage (dev/staging/prod)
read -p "Enter stage (dev/staging/prod) [default: dev]: " STAGE
STAGE=${STAGE:-dev}

echo ""
echo -e "${YELLOW}Attempting to fetch RDS connection details from AWS SSM...${NC}"
echo ""

# Try to get connection details from SSM
DB_HOST=$(aws ssm get-parameter --name "/warmpawz/${STAGE}/db/host" --query Parameter.Value --output text 2>/dev/null || echo "")
DB_PORT=$(aws ssm get-parameter --name "/warmpawz/${STAGE}/db/port" --query Parameter.Value --output text 2>/dev/null || echo "5432")
DB_NAME=$(aws ssm get-parameter --name "/warmpawz/${STAGE}/db/name" --query Parameter.Value --output text 2>/dev/null || echo "")
DB_USER=$(aws ssm get-parameter --name "/warmpawz/${STAGE}/db/user" --query Parameter.Value --output text 2>/dev/null || echo "")

if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
    echo -e "${YELLOW}⚠️  Could not retrieve connection details from SSM${NC}"
    echo ""
    echo "Please provide connection details manually:"
    echo ""
    read -p "RDS Endpoint (hostname): " DB_HOST
    read -p "Database Port [default: 5432]: " DB_PORT
    DB_PORT=${DB_PORT:-5432}
    read -p "Database Name: " DB_NAME
    read -p "Database User: " DB_USER
    read -sp "Database Password: " DB_PASSWORD
    echo ""
else
    echo -e "${GREEN}✅ Retrieved connection details from SSM${NC}"
    echo "  Host: $DB_HOST"
    echo "  Port: $DB_PORT"
    echo "  Database: $DB_NAME"
    echo "  User: $DB_USER"
    echo ""
    read -sp "Database Password (from Secrets Manager or manual): " DB_PASSWORD
    echo ""
fi

echo ""
echo -e "${YELLOW}Connecting to RDS...${NC}"

# Set password
export PGPASSWORD=$DB_PASSWORD

# Test connection first
echo "Testing connection to $DB_HOST:$DB_PORT/$DB_NAME..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Connection successful${NC}"
    echo ""
    
    # Check current state of diagnostic_tests table
    echo -e "${YELLOW}Checking current diagnostic_tests table structure...${NC}"
    echo ""
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'diagnostic_tests'
        ORDER BY ordinal_position;
    " 2>/dev/null || echo "Table might not exist yet"
    
    echo ""
    echo -e "${YELLOW}Running migration: $MIGRATION_FILE${NC}"
    echo ""
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ Migration completed successfully!${NC}"
        echo ""
        
        # Verify columns were added
        echo -e "${YELLOW}Verifying diagnostic_tests table structure after migration...${NC}"
        echo ""
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'diagnostic_tests'
            ORDER BY ordinal_position;
        "
        
        # Check for test_code column specifically
        TEST_CODE_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_name = 'diagnostic_tests' 
            AND column_name = 'test_code';
        " | xargs)
        
        echo ""
        if [ "$TEST_CODE_EXISTS" -ge 1 ]; then
            echo -e "${GREEN}✅ test_code column verified!${NC}"
        else
            echo -e "${RED}❌ test_code column NOT found - migration may have failed${NC}"
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
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}🎉 Migration 503 Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Deploy the backend: cd backend/lambda && ./scripts/deploy.sh dev"
echo "  2. Or push to GitHub to trigger CI/CD"
