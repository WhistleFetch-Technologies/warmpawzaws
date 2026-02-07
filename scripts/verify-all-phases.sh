#!/bin/bash

# ============================================================================
# COMPREHENSIVE VERIFICATION: All Phases
# ============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Comprehensive Verification: All Phases${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Run all verification scripts
echo -e "${YELLOW}Running Phase 1-6 verifications...${NC}"
echo ""

./scripts/verify-phase3.sh
echo ""
./scripts/verify-phase4.sh
echo ""
./scripts/verify-phase5.sh
echo ""
./scripts/verify-phase6.sh

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ All Phases Verified!${NC}"
echo -e "${BLUE}========================================${NC}"
