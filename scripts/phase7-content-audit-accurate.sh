#!/bin/bash

# ============================================================================
# PHASE 7: Accurate Content Enrichment & Navigation Consistency Audit
# ============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 7: Accurate Content & Design Audit${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for actual placeholder content (excluding HTML input placeholders and node_modules)
echo -e "${YELLOW}Checking for actual placeholder content...${NC}"
ACTUAL_PLACEHOLDERS=$(grep -r "coming soon\|under construction" apps/customer-web apps/vendor-web --include="*.tsx" --include="*.ts" \
  --exclude-dir=node_modules -i | grep -v "placeholder=" | grep -v "SelectItem.*coming_soon" | wc -l | tr -d ' ')

if [ "$ACTUAL_PLACEHOLDERS" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠${NC} Found $ACTUAL_PLACEHOLDERS actual 'coming soon' instances"
    echo -e "  ${YELLOW}Details:${NC}"
    grep -r "coming soon\|under construction" apps/customer-web apps/vendor-web --include="*.tsx" --include="*.ts" \
      --exclude-dir=node_modules -i | grep -v "placeholder=" | grep -v "SelectItem.*coming_soon" | head -5
else
    echo -e "  ${GREEN}✓${NC} No actual placeholder content found"
fi

# Check design theme consistency (only in customer-web and vendor-web)
echo ""
echo -e "${YELLOW}Checking design theme consistency...${NC}"

# Count theme color usage in actual component files
THEME_FILES=$(find apps/customer-web apps/vendor-web -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs grep -l "#FF8C42\|FF8C42" 2>/dev/null | wc -l | tr -d ' ')
THEME_INSTANCES=$(grep -r "#FF8C42\|FF8C42" apps/customer-web apps/vendor-web --include="*.tsx" --include="*.ts" \
  --exclude-dir=node_modules | wc -l | tr -d ' ')

if [ "$THEME_FILES" -gt 50 ]; then
    echo -e "  ${GREEN}✓${NC} Theme color #FF8C42 used in $THEME_FILES files ($THEME_INSTANCES instances)"
else
    echo -e "  ${YELLOW}⚠${NC} Theme color used in only $THEME_FILES files"
fi

# Count container width usage
CONTAINER_FILES=$(find apps/customer-web apps/vendor-web -name "*.tsx" -o -name "*.ts" | grep -v node_modules | xargs grep -l "max-w-\[430px\]" 2>/dev/null | wc -l | tr -d ' ')
CONTAINER_INSTANCES=$(grep -r "max-w-\[430px\]" apps/customer-web apps/vendor-web --include="*.tsx" --include="*.ts" \
  --exclude-dir=node_modules | wc -l | tr -d ' ')

if [ "$CONTAINER_FILES" -gt 30 ]; then
    echo -e "  ${GREEN}✓${NC} Container width max-w-[430px] used in $CONTAINER_FILES files ($CONTAINER_INSTANCES instances)"
else
    echo -e "  ${YELLOW}⚠${NC} Container width used in only $CONTAINER_FILES files"
fi

# Check for HTML input placeholders (these are normal and expected)
echo ""
echo -e "${YELLOW}Checking input placeholders (normal HTML attributes)...${NC}"
INPUT_PLACEHOLDERS=$(grep -r 'placeholder="' apps/customer-web apps/vendor-web --include="*.tsx" --include="*.ts" \
  --exclude-dir=node_modules | wc -l | tr -d ' ')
echo -e "  ${GREEN}✓${NC} Found $INPUT_PLACEHOLDERS input placeholder attributes (normal and expected)"

# Check for empty states or missing content
echo ""
echo -e "${YELLOW}Checking for empty states...${NC}"
EMPTY_STATES=$(grep -r "No.*data\|No.*results\|empty.*state\|nothing.*found" apps/customer-web apps/vendor-web \
  --include="*.tsx" --include="*.ts" --exclude-dir=node_modules -i | wc -l | tr -d ' ')
if [ "$EMPTY_STATES" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} Found $EMPTY_STATES empty state handlers (good UX practice)"
else
    echo -e "  ${YELLOW}⚠${NC} No empty state handlers found"
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
if [ "$ACTUAL_PLACEHOLDERS" -eq 0 ] && [ "$THEME_FILES" -gt 50 ] && [ "$CONTAINER_FILES" -gt 30 ]; then
    echo -e "${GREEN}✅ Phase 7 Audit: PASSED${NC}"
    echo -e "  - No placeholder content issues"
    echo -e "  - Design theme consistently applied"
    echo -e "  - Container width consistently applied"
else
    echo -e "${YELLOW}⚠ Phase 7 Audit: NEEDS REVIEW${NC}"
    if [ "$ACTUAL_PLACEHOLDERS" -gt 0 ]; then
        echo -e "  - Found $ACTUAL_PLACEHOLDERS 'coming soon' instances to review"
    fi
    if [ "$THEME_FILES" -lt 50 ]; then
        echo -e "  - Theme color could be used more consistently"
    fi
    if [ "$CONTAINER_FILES" -lt 30 ]; then
        echo -e "  - Container width could be used more consistently"
    fi
fi
echo -e "${BLUE}========================================${NC}"
