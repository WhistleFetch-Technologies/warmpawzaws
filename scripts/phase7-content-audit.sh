#!/bin/bash

# ============================================================================
# PHASE 7: Content Enrichment & Navigation Consistency Audit
# ============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 7: Content & Navigation Audit${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for placeholder text
echo -e "${YELLOW}Checking for placeholder content...${NC}"
PLACEHOLDERS=$(grep -r "placeholder\|coming soon\|under construction" apps/ --include="*.tsx" --include="*.ts" -i | wc -l)
if [ $PLACEHOLDERS -gt 0 ]; then
    echo -e "  ${YELLOW}⚠${NC} Found $PLACEHOLDERS potential placeholder instances"
else
    echo -e "  ${GREEN}✓${NC} No placeholder content found"
fi

# Check design theme consistency
echo -e "${YELLOW}Checking design theme consistency...${NC}"
THEME_COUNT=$(grep -r "#FF8C42\|FF8C42" apps/ --include="*.tsx" --include="*.ts" | wc -l)
if [ $THEME_COUNT -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} Found $THEME_COUNT instances of theme color #FF8C42"
else
    echo -e "  ${YELLOW}⚠${NC} Theme color not consistently used"
fi

CONTAINER_COUNT=$(grep -r "max-w-\[430px\]" apps/ --include="*.tsx" --include="*.ts" | wc -l)
if [ $CONTAINER_COUNT -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} Found $CONTAINER_COUNT instances of max-w-[430px] container"
else
    echo -e "  ${YELLOW}⚠${NC} Container width not consistently applied"
fi

# Check for missing error handling
echo -e "${YELLOW}Checking error handling...${NC}"
ERROR_HANDLING=$(grep -r "catch\|error\|Error" apps/ --include="*.tsx" --include="*.ts" | wc -l)
if [ $ERROR_HANDLING -gt 100 ]; then
    echo -e "  ${GREEN}✓${NC} Error handling present ($ERROR_HANDLING instances)"
else
    echo -e "  ${YELLOW}⚠${NC} Limited error handling found"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Phase 7 Audit Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
