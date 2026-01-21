#!/bin/bash

# ============================================================================
# WARMPAWZ CONTRACT & INTEGRATION TESTS RUNNER
# ============================================================================
# 
# Runs comprehensive regressive tests that verify:
# - Database schema integrity
# - API contract validation
# - Parameter tracing (DB → API → Frontend)
# - Business flow integration
# - Payment, tax, and logistics rules
# 
# Usage:
#   ./scripts/run-contract-tests.sh [options]
# 
# Options:
#   --all           Run all contract tests
#   --schema        Run schema validation tests only
#   --contracts     Run API contract tests only
#   --tracing       Run parameter tracing tests only
#   --flows         Run business flow integration tests only
#   --payments      Run payment rules validation tests only
#   --report        Generate HTML report and open it
#   --ci            CI mode (no retries, JSON output)
# 
# Date: 2026-01-20
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
TEST_TYPE="all"
GENERATE_REPORT=false
CI_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --all)
      TEST_TYPE="all"
      shift
      ;;
    --schema)
      TEST_TYPE="schema"
      shift
      ;;
    --contracts)
      TEST_TYPE="contracts"
      shift
      ;;
    --tracing)
      TEST_TYPE="tracing"
      shift
      ;;
    --flows)
      TEST_TYPE="flows"
      shift
      ;;
    --payments)
      TEST_TYPE="payments"
      shift
      ;;
    --report)
      GENERATE_REPORT=true
      shift
      ;;
    --ci)
      CI_MODE=true
      shift
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║        WARMPAWZ CONTRACT & INTEGRATION TESTS                                 ║"
echo "║        Database Schema → API Contracts → Parameter Tracing                   ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Navigate to playwright directory
cd "$(dirname "$0")/../tests/playwright"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install
fi

# Determine which project to run
case $TEST_TYPE in
  "all")
    PROJECT="contract-tests"
    echo -e "${BLUE}Running ALL contract tests...${NC}"
    ;;
  "schema")
    PROJECT="schema-validation"
    echo -e "${BLUE}Running schema validation tests...${NC}"
    ;;
  "contracts")
    PROJECT="parameter-tracing"
    echo -e "${BLUE}Running API contract tests...${NC}"
    ;;
  "tracing")
    PROJECT="parameter-tracing"
    echo -e "${BLUE}Running parameter tracing tests...${NC}"
    ;;
  "flows")
    PROJECT="business-flow-integration"
    echo -e "${BLUE}Running business flow integration tests...${NC}"
    ;;
  "payments")
    PROJECT="payment-rules-validation"
    echo -e "${BLUE}Running payment rules validation tests...${NC}"
    ;;
esac

# Build command
if [ "$CI_MODE" = true ]; then
  CMD="npx playwright test --project=$PROJECT --reporter=json --reporter=list"
else
  CMD="npx playwright test --project=$PROJECT"
fi

echo -e "${CYAN}Executing: $CMD${NC}"
echo ""

# Run tests
START_TIME=$(date +%s)

$CMD 2>&1 | tee test-output.log

EXIT_CODE=${PIPESTATUS[0]}

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Parse results from log - use grep -E for portability
PASSED=$(grep -oE '[0-9]+ passed' test-output.log 2>/dev/null | tail -1 | grep -oE '[0-9]+' || echo "0")
FAILED=$(grep -oE '[0-9]+ failed' test-output.log 2>/dev/null | tail -1 | grep -oE '[0-9]+' || echo "0")
SKIPPED=$(grep -oE '[0-9]+ skipped' test-output.log 2>/dev/null | tail -1 | grep -oE '[0-9]+' || echo "0")
TOTAL=$((PASSED + FAILED + SKIPPED))

# Set defaults if parsing failed
PASSED=${PASSED:-0}
FAILED=${FAILED:-0}
SKIPPED=${SKIPPED:-0}
TOTAL=${TOTAL:-0}

# Calculate pass rate
if [ "$TOTAL" -gt 0 ] 2>/dev/null; then
  PASS_RATE=$(echo "scale=1; ($PASSED / $TOTAL) * 100" | bc 2>/dev/null || echo "100")
else
  PASS_RATE="0"
fi

# Generate summary
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗"
echo -e "║                         CONTRACT TESTS SUMMARY                                ║"
echo -e "╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$FAILED" -eq 0 ] 2>/dev/null && [ "$PASSED" -gt 0 ] 2>/dev/null; then
  echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
elif [ "$FAILED" -gt 0 ] 2>/dev/null; then
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
elif [ "$PASSED" -gt 0 ] 2>/dev/null; then
  echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
else
  echo -e "${YELLOW}⚠️  COULD NOT PARSE RESULTS - CHECK LOG${NC}"
fi

echo ""
echo -e "📊 ${BLUE}Test Results:${NC}"
echo -e "   Total:   ${TOTAL:-0}"
echo -e "   ${GREEN}Passed:  ${PASSED:-0}${NC}"
echo -e "   ${RED}Failed:  ${FAILED:-0}${NC}"
echo -e "   ${YELLOW}Skipped: ${SKIPPED:-0}${NC}"
echo -e "   ${CYAN}Pass Rate: ${PASS_RATE}%${NC}"
echo ""
echo -e "⏱️  Duration: ${DURATION} seconds"
echo ""

# Generate report
if [ "$GENERATE_REPORT" = true ]; then
  echo -e "${YELLOW}Generating HTML report...${NC}"
  npx playwright show-report test-results/html-report &
  sleep 2
  echo -e "${GREEN}Report opened in browser${NC}"
fi

# Create contract tests report file
REPORT_FILE="CONTRACT_TESTS_REPORT.md"
cat > "$REPORT_FILE" << EOF
# Warmpawz Contract & Integration Tests Report

**Date:** $(date '+%Y-%m-%d %H:%M:%S')
**Test Type:** $TEST_TYPE
**Duration:** ${DURATION} seconds

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${TOTAL:-0} |
| Passed | ${PASSED:-0} |
| Failed | ${FAILED:-0} |
| Skipped | ${SKIPPED:-0} |
| Pass Rate | ${PASS_RATE}% |

## Test Categories

### 1. Database Schema Validation
- Table existence and structure
- Column definitions and types
- Foreign key relationships
- Constraint validations

### 2. API Contract Validation
- Request/Response schema verification
- Required field validation
- Data type enforcement
- Error response structure

### 3. Parameter Tracing
- DB column → API field mapping
- API request → DB insertion
- Frontend form → API request
- Consistent field naming (snake_case ↔ camelCase)

### 4. Business Flow Integration
- Vendor onboarding (Center & Solo)
- Service configuration
- Customer booking (Center, Home, Tele)
- Order/Delivery flows
- Problem grid navigation

### 5. Payment Rules Validation
- GST/Tax calculations
- Platform fees and convenience charges
- Logistics and delivery charges
- Discounts and promotions
- Wallet balance usage
- Refund and cancellation policies
- Subscription and package tracking
- Tier commission system

## Test Results Details

$(cat test-output.log 2>/dev/null || echo "No detailed log available")

---

*Generated by Warmpawz Contract Tests Runner*
EOF

echo -e "${GREEN}Report saved to: $REPORT_FILE${NC}"
echo ""

# Cleanup
rm -f test-output.log

exit $EXIT_CODE
