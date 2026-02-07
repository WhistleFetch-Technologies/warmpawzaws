#!/bin/bash
# Run All Synthetic Tests - Unified Appointment Management
# Runs all test suites: Backend, Frontend, UI, API Contracts, Handlers, Wireframe
# Usage: ./tests/run-all-synthetic-tests.sh

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  COMPREHENSIVE SYNTHETIC TEST SUITE                           ║${NC}"
echo -e "${GREEN}║  Unified Appointment Management                               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Test results
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0

# Run Test Suite 1: Systematic Synthetic Test
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test Suite 1: Systematic Synthetic Test (Comprehensive)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "$SCRIPT_DIR/systematic-synthetic-test-appointment-management.sh" ]; then
    bash "$SCRIPT_DIR/systematic-synthetic-test-appointment-management.sh"
    SUITE1_EXIT=$?
    
    if [ $SUITE1_EXIT -eq 0 ]; then
        echo -e "${GREEN}✅ Test Suite 1: PASSED${NC}"
    else
        echo -e "${RED}❌ Test Suite 1: FAILED${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Test Suite 1 script not found${NC}"
    SUITE1_EXIT=1
fi

echo ""

# Run Test Suite 2: Frontend UI Components
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test Suite 2: Frontend UI Components${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "$SCRIPT_DIR/test-frontend-ui-components.js" ]; then
    node "$SCRIPT_DIR/test-frontend-ui-components.js"
    SUITE2_EXIT=$?
    
    if [ $SUITE2_EXIT -eq 0 ]; then
        echo -e "${GREEN}✅ Test Suite 2: PASSED${NC}"
    else
        echo -e "${RED}❌ Test Suite 2: FAILED${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Test Suite 2 script not found${NC}"
    SUITE2_EXIT=1
fi

echo ""

# Run Test Suite 3: Backend Handlers
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test Suite 3: Backend Handlers${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "$SCRIPT_DIR/test-backend-handlers.js" ]; then
    node "$SCRIPT_DIR/test-backend-handlers.js"
    SUITE3_EXIT=$?
    
    if [ $SUITE3_EXIT -eq 0 ]; then
        echo -e "${GREEN}✅ Test Suite 3: PASSED${NC}"
    else
        echo -e "${RED}❌ Test Suite 3: FAILED${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Test Suite 3 script not found${NC}"
    SUITE3_EXIT=1
fi

echo ""

# Run Test Suite 4: API Contracts
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test Suite 4: API Contracts${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "$SCRIPT_DIR/test-api-contracts.js" ]; then
    node "$SCRIPT_DIR/test-api-contracts.js"
    SUITE4_EXIT=$?
    
    if [ $SUITE4_EXIT -eq 0 ]; then
        echo -e "${GREEN}✅ Test Suite 4: PASSED${NC}"
    else
        echo -e "${RED}❌ Test Suite 4: FAILED${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Test Suite 4 script not found${NC}"
    SUITE4_EXIT=1
fi

echo ""

# Final Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}FINAL TEST SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

SUITE1_STATUS=$([ $SUITE1_EXIT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
SUITE2_STATUS=$([ $SUITE2_EXIT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
SUITE3_STATUS=$([ $SUITE3_EXIT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")
SUITE4_STATUS=$([ $SUITE4_EXIT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED")

echo -e "Test Suite 1 (Systematic): ${SUITE1_STATUS}"
echo -e "Test Suite 2 (Frontend UI): ${SUITE2_STATUS}"
echo -e "Test Suite 3 (Backend Handlers): ${SUITE3_STATUS}"
echo -e "Test Suite 4 (API Contracts): ${SUITE4_STATUS}"
echo ""

TOTAL_FAILED=$((SUITE1_EXIT + SUITE2_EXIT + SUITE3_EXIT + SUITE4_EXIT))

if [ $TOTAL_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ✅ ✅ ALL TEST SUITES PASSED! ✅ ✅ ✅${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}❌ SOME TEST SUITES FAILED${NC}"
    echo ""
    exit 1
fi
