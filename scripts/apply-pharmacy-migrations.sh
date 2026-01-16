#!/bin/bash
# ============================================================================
# Apply Pharmacy UAT Configuration Migrations
# ============================================================================
# This script applies migrations 047 and 051 to update Pharmacy role capabilities
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Pharmacy UAT - Apply Database Migrations                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ] && [ -z "$SUPABASE_DB_URL" ]; then
    echo -e "${YELLOW}⚠️  Database connection not configured${NC}"
    echo ""
    echo "Please set one of the following:"
    echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
    echo "  OR"
    echo "  export SUPABASE_DB_URL='postgresql://postgres:password@db.project.supabase.co:5432/postgres'"
    echo ""
    read -p "Do you want to set it now? (y/n): " SET_NOW
    if [ "$SET_NOW" = "y" ]; then
        echo ""
        echo "Enter database connection string:"
        echo "  Format: postgresql://user:password@host:port/database"
        read -p "DATABASE_URL: " DB_INPUT
        export DATABASE_URL="$DB_INPUT"
    else
        echo ""
        echo "Exiting. Set DATABASE_URL and run again."
        exit 1
    fi
fi

DB_URL="${DATABASE_URL:-$SUPABASE_DB_URL}"
echo -e "${GREEN}✅ Using database connection${NC}"
echo ""

# Change to db directory
cd "$PROJECT_ROOT/db"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Option 1: Run all migrations (safe - idempotent)
echo -e "${BLUE}📋 Option 1: Run all migrations (recommended)${NC}"
echo "This will run all migrations including 047 and 051"
echo ""
read -p "Run all migrations? (y/n): " RUN_ALL

if [ "$RUN_ALL" = "y" ]; then
    echo ""
    echo -e "${BLUE}🚀 Running all migrations...${NC}"
    echo "────────────────────────────────────────────────────────────"
    npm run migrate:up
    echo ""
    echo -e "${GREEN}✅ Migrations completed!${NC}"
else
    # Option 2: Run specific migrations
    echo ""
    echo -e "${BLUE}📋 Option 2: Run specific migrations${NC}"
    echo ""
    
    echo -e "${BLUE}Running Migration 047 (Seed Roles)...${NC}"
    node run-migration.js migrations/047_seed_roles.sql
    
    echo ""
    echo -e "${BLUE}Running Migration 051 (Role Permissions)...${NC}"
    node run-migration.js migrations/051_seed_role_permissions.sql
    
    echo ""
    echo -e "${GREEN}✅ Specific migrations completed!${NC}"
fi

echo ""
echo -e "${BLUE}🔍 Verifying Pharmacy role configuration...${NC}"
echo "────────────────────────────────────────────────────────────"

# Run verification
cd "$PROJECT_ROOT"
if [ -f "scripts/verify-pharmacy-config.sh" ]; then
    chmod +x scripts/verify-pharmacy-config.sh
    ./scripts/verify-pharmacy-config.sh
else
    echo -e "${YELLOW}⚠️  Verification script not found, running manual check...${NC}"
    cd "$PROJECT_ROOT/db"
    npm run migrate:status
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ MIGRATIONS COMPLETE                                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Clear browser cache and localStorage"
echo "  2. Log in as Pharmacy vendor"
echo "  3. Verify dashboard shows only Pharmacy-relevant features"
echo "  4. Test Inventory button persistence"
echo ""
