#!/bin/bash

# 🧪 Run All Tests Script
# Runs all test scripts in sequence

set -e  # Exit on error

echo "🧪 Starting Test Suite"
echo "════════════════════════════════════════"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js to run tests."
    exit 1
fi

# Check if TypeScript is available
if ! command -v tsx &> /dev/null && ! command -v ts-node &> /dev/null; then
    echo "⚠️  TypeScript runner not found. Installing tsx..."
    npm install -g tsx || npm install -g ts-node
fi

# Set test runner
RUNNER="tsx"
if ! command -v tsx &> /dev/null; then
    RUNNER="ts-node"
fi

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_file=$2
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Running: $test_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if $RUNNER "$test_file" 2>&1; then
        echo ""
        echo -e "${GREEN}✅ $test_name PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo ""
        echo -e "${RED}❌ $test_name FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Run tests
echo "1️⃣ Testing Webhook Signature Verification..."
run_test "Webhook Signature Test" "scripts/test-webhook-signature.ts"

echo ""
echo "2️⃣ Testing Payment Flow (E2E)..."
echo -e "${YELLOW}⚠️  Note: This requires API access and may create test data${NC}"
read -p "Continue with payment flow test? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    run_test "Payment Flow Test" "scripts/test-payment-flow.ts"
else
    echo -e "${YELLOW}⏭️  Skipped${NC}"
fi

echo ""
echo "3️⃣ Testing Refund Flow..."
echo -e "${YELLOW}⚠️  Note: This requires API access and may create test data${NC}"
read -p "Continue with refund flow test? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    run_test "Refund Flow Test" "scripts/test-refund-flow.ts"
else
    echo -e "${YELLOW}⏭️  Skipped${NC}"
fi

# Summary
echo ""
echo "════════════════════════════════════════"
echo "📊 Test Suite Summary"
echo "════════════════════════════════════════"
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Please review the output above.${NC}"
    exit 1
fi

