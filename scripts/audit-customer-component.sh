#!/bin/bash
# Comprehensive Customer Component Audit Script
# Checks UI, Lambda, DB Schema, Flow Handlers, and Lifecycle

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     Customer Component Comprehensive Audit                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
UI_COUNT=0
LAMBDA_COUNT=0
DB_TABLE_COUNT=0
GAPS=0

echo -e "${BLUE}=== 1. UI COMPONENTS AUDIT ===${NC}"
echo ""

# Count customer UI components
UI_FILES=$(find apps/customer-web/components/customer -name "*.tsx" -type f 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}✅ Customer UI Components: ${UI_FILES} files${NC}"

# List key components
echo ""
echo "Key Components:"
find apps/customer-web/components/customer -name "*.tsx" -type f 2>/dev/null | head -20 | while read file; do
  basename "$file" | sed 's/^/  - /'
done

echo ""
echo -e "${BLUE}=== 2. LAMBDA ENDPOINTS AUDIT ===${NC}"
echo ""

# Count customer endpoints
LAMBDA_ENDPOINTS=$(grep -r "app\.(get|post|put|delete)(" backend/lambda/src/endpoints --include="*.ts" | grep -i customer | wc -l | tr -d ' ')
echo -e "${GREEN}✅ Customer Lambda Endpoints: ${LAMBDA_ENDPOINTS} routes${NC}"

# List endpoint files
echo ""
echo "Endpoint Files:"
find backend/lambda/src/endpoints -name "*customer*.ts" -type f 2>/dev/null | while read file; do
  basename "$file" | sed 's/^/  - /'
done

echo ""
echo -e "${BLUE}=== 3. DATABASE SCHEMA AUDIT ===${NC}"
echo ""

# Count customer tables
DB_TABLES=$(grep -r "CREATE TABLE.*customer" db/migrations --include="*.sql" -i | wc -l | tr -d ' ')
echo -e "${GREEN}✅ Customer Database Tables: ${DB_TABLES} tables${NC}"

# List customer tables
echo ""
echo "Customer Tables:"
grep -r "CREATE TABLE.*customer" db/migrations --include="*.sql" -i | sed 's/.*CREATE TABLE.*\(customer[^ ]*\).*/\1/i' | sort -u | sed 's/^/  - /'

echo ""
echo -e "${BLUE}=== 4. FLOW HANDLERS AUDIT ===${NC}"
echo ""

# Check key flows
echo "Checking key customer flows..."
FLOWS=("onboarding" "booking" "payment" "wallet" "loyalty" "referral" "appointments")
for flow in "${FLOWS[@]}"; do
  if grep -r "$flow" apps/customer-web/components/customer --include="*.tsx" -q 2>/dev/null; then
    echo -e "  ${GREEN}✅ $flow flow${NC}"
  else
    echo -e "  ${RED}❌ $flow flow missing${NC}"
    GAPS=$((GAPS + 1))
  fi
done

echo ""
echo -e "${BLUE}=== 5. LIFECYCLE IMPLEMENTATION ===${NC}"
echo ""

# Check lifecycle states
LIFECYCLE_STATES=("pending" "confirmed" "in_progress" "completed" "cancelled")
for state in "${LIFECYCLE_STATES[@]}"; do
  if grep -r "$state" backend/lambda/src/endpoints --include="*.ts" -q 2>/dev/null; then
    echo -e "  ${GREEN}✅ $state state handler${NC}"
  else
    echo -e "  ${YELLOW}⚠️  $state state handler${NC}"
  fi
done

echo ""
echo -e "${BLUE}=== SUMMARY ===${NC}"
echo ""
echo -e "${GREEN}UI Components: ${UI_FILES}${NC}"
echo -e "${GREEN}Lambda Endpoints: ${LAMBDA_ENDPOINTS}${NC}"
echo -e "${GREEN}Database Tables: ${DB_TABLES}${NC}"
if [ $GAPS -eq 0 ]; then
  echo -e "${GREEN}Gaps Found: 0${NC}"
else
  echo -e "${RED}Gaps Found: ${GAPS}${NC}"
fi

echo ""
echo "✅ Audit complete!"
