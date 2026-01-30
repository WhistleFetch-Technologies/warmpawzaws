#!/bin/bash

# Run diagnostic query for vendor 8123456780
# This script provides the SQL query to run in your database

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Diagnostic Query for Vendor 8123456780${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${CYAN}Run this SQL query in your database:${NC}"
echo ""
echo -e "${YELLOW}File: queries/diagnose-vendor-8123456780.sql${NC}"
echo ""
cat queries/diagnose-vendor-8123456780.sql
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}What to Look For:${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "1. Check 'status_check' - Should be '✅ Status OK'"
echo "2. Check 'solo_check' - Should be '✅ Solo Vendor Detected'"
echo "3. Check 'services_check' - Should be '✅ Services Published'"
echo "4. Check 'schedule_check' - Should be '✅ Schedule Configured'"
echo "5. Check 'final_verdict' - Should be '✅ SHOULD APPEAR'"
echo ""
echo -e "${YELLOW}The first ❌ you find is the root cause!${NC}"
echo ""
echo -e "${CYAN}After running the query, share the results and I'll provide the fix.${NC}"
