#!/bin/bash
# ============================================================================
# WARMPAWZ PLAYWRIGHT E2E TEST RUNNER
# ============================================================================
# Runs Playwright E2E tests for all applications
# Usage: ./scripts/run-playwright-tests.sh [project]
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_DIR="$PROJECT_ROOT/tests/playwright"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT="${1:-all}"

echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}║   🎭 WARMPAWZ PLAYWRIGHT E2E TEST RUNNER                      ║${NC}"
echo -e "${CYAN}║                                                               ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Navigate to test directory
cd "$TEST_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${BLUE}📦 Installing dependencies...${NC}"
  npm install
fi

# Install Playwright browsers if needed
if ! npx playwright --version &> /dev/null; then
  echo -e "${BLUE}🌐 Installing Playwright browsers...${NC}"
  npx playwright install chromium
fi

echo ""
echo -e "${BLUE}🧪 Running Playwright Tests${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Run tests based on project selection
case "$PROJECT" in
  "admin")
    echo -e "${YELLOW}Running Admin Portal tests...${NC}"
    npx playwright test --project=admin-chromium
    ;;
  "customer")
    echo -e "${YELLOW}Running Customer App tests...${NC}"
    npx playwright test --project=customer-chromium
    ;;
  "vendor")
    echo -e "${YELLOW}Running Vendor Portal tests...${NC}"
    npx playwright test --project=vendor-chromium
    ;;
  "mobile")
    echo -e "${YELLOW}Running Mobile tests...${NC}"
    npx playwright test --project=customer-mobile
    ;;
  "api")
    echo -e "${YELLOW}Running API tests...${NC}"
    npx playwright test --project=api
    ;;
  "all")
    echo -e "${YELLOW}Running all tests...${NC}"
    npx playwright test
    ;;
  *)
    echo -e "${RED}Unknown project: $PROJECT${NC}"
    echo "Usage: $0 [admin|customer|vendor|mobile|api|all]"
    exit 1
    ;;
esac

# Check exit code
if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   ✅ ALL PLAYWRIGHT TESTS PASSED                               ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
else
  echo ""
  echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║   ❌ SOME PLAYWRIGHT TESTS FAILED                              ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
fi

echo ""
echo -e "${BLUE}📊 Test Reports:${NC}"
echo -e "   HTML Report: $TEST_DIR/test-results/html-report"
echo -e "   JSON Results: $TEST_DIR/test-results/results.json"
echo ""
echo -e "${BLUE}💡 To view the HTML report, run:${NC}"
echo -e "   cd $TEST_DIR && npx playwright show-report test-results/html-report"
echo ""
