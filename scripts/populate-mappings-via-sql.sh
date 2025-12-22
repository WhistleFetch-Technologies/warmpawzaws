#!/bin/bash

# ============================================================================
# Populate Problem Grid Mappings via SQL (Alternative Method)
# ============================================================================
# Direct SQL approach if endpoint is not available
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Populate Problem Grid Mappings (SQL Method)${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql not found. Please use the API endpoint method instead.${NC}"
    echo ""
    echo "Run: ./scripts/populate-problem-grid-mappings.sh"
    exit 1
fi

# Check for database connection string
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set. Loading from .env...${NC}"
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not found.${NC}"
    echo ""
    echo "Please set DATABASE_URL or use the API endpoint method:"
    echo "   ./scripts/populate-problem-grid-mappings.sh"
    exit 1
fi

echo -e "${BLUE}Connecting to database...${NC}"
echo ""

# First, ensure the migration function exists
echo -e "${BLUE}1. Applying migration (if not already applied)...${NC}"
psql "$DATABASE_URL" -f db/migrations/010_populate_problem_grid_mappings.sql

echo ""
echo -e "${BLUE}2. Running TypeScript migration service...${NC}"
echo -e "${YELLOW}Note: This requires Deno to be installed${NC}"
echo ""

# Check if Deno is available
if command -v deno &> /dev/null; then
    deno run --allow-net --allow-env --allow-read supabase/lib/services/problem-grid-migration.ts
else
    echo -e "${YELLOW}⚠️  Deno not found. Please use the API endpoint method instead.${NC}"
    echo ""
    echo "Run: ./scripts/populate-problem-grid-mappings.sh"
    exit 1
fi

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ Problem grid mappings populated!${NC}"
echo -e "${BLUE}============================================================================${NC}"

