#!/bin/bash

# ============================================================================
# Run All Tests - Hard Refresh Fix
# ============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Running All Tests - Hard Refresh Fix${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Test 1: Quick API Tests
echo -e "${YELLOW}[1/3] Running Quick API Tests...${NC}"
./test-login-flows.sh
echo ""

# Test 2: Integration Tests
echo -e "${YELLOW}[2/3] Running Integration Tests...${NC}"
node test-hard-refresh-integration.js
echo ""

# Test 3: Edge Case Tests
echo -e "${YELLOW}[3/3] Running Edge Case Tests...${NC}"
node test-edge-cases-comprehensive.js
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All Tests Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "See COMPREHENSIVE_TEST_REPORT.md for detailed results"
