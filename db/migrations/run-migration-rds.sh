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

echo -e "${YELLOW}Running Vet Clinic Service Styles Migration on AWS RDS${NC}"
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
MIGRATION_FILE="db/migrations/301_update_vet_clinic_service_styles.sql"

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
        
        # Verify role configuration updated
        echo "Verifying role configuration..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT 
                name,
                config->'serviceStyles' as service_styles,
                updated_at
            FROM roles 
            WHERE name = 'vet_clinic' AND is_active = true;
        "
        
        # Verify service styles
        SERVICE_STYLES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT config->'serviceStyles' FROM roles WHERE name = 'vet_clinic' AND is_active = true;")
        echo ""
        echo "Service styles configured: $SERVICE_STYLES"
        echo "Expected: [\"at_center\", \"at_home\", \"tele\"]"
        
        if echo "$SERVICE_STYLES" | grep -q "at_center" && echo "$SERVICE_STYLES" | grep -q "at_home" && echo "$SERVICE_STYLES" | grep -q "tele"; then
            echo -e "${GREEN}✅ Migration verification successful!${NC}"
        else
            echo -e "${YELLOW}⚠️  Warning: Service styles may not be correctly configured${NC}"
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
