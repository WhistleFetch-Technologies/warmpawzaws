#!/bin/bash
# ============================================================================
# WARMPAWZ E2E BUSINESS FLOWS TEST RUNNER
# ============================================================================
# 
# Runs comprehensive E2E tests for all business flows and generates report
# 
# Usage:
#   ./scripts/run-e2e-business-flows.sh [project]
# 
# Examples:
#   ./scripts/run-e2e-business-flows.sh              # Run all tests
#   ./scripts/run-e2e-business-flows.sh vendor       # Run vendor tests only
#   ./scripts/run-e2e-business-flows.sh customer     # Run customer tests only
#   ./scripts/run-e2e-business-flows.sh quick        # Run quick smoke tests
# 
# Date: 2026-01-20
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_DIR="$PROJECT_ROOT/tests/playwright"
REPORT_DIR="$TEST_DIR/test-results"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   WARMPAWZ E2E BUSINESS FLOWS TEST SUITE                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Navigate to test directory
cd "$TEST_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 Installing dependencies...${NC}"
  npm install
fi

# Install Playwright browsers if needed
if ! npx playwright --version > /dev/null 2>&1; then
  echo -e "${YELLOW}🌐 Installing Playwright browsers...${NC}"
  npx playwright install chromium
fi

# Determine which tests to run
PROJECT_FILTER="$1"

echo -e "${BLUE}📋 Test Configuration:${NC}"
echo -e "   API URL: ${API_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
echo -e "   Customer URL: ${CUSTOMER_URL:-https://d2aoyjj8ine0wk.cloudfront.net}"
echo -e "   Vendor URL: ${VENDOR_URL:-https://d1s6ykkj381k58.cloudfront.net}"
echo -e "   Admin URL: ${ADMIN_URL:-https://dfof7mguaa0a5.cloudfront.net}"
echo ""

# Create report directory
mkdir -p "$REPORT_DIR/screenshots"

# Run tests based on argument
case "$PROJECT_FILTER" in
  vendor)
    echo -e "${GREEN}🧪 Running Vendor Onboarding Tests...${NC}"
    npx playwright test --project=vendor-onboarding --project=vendor-chromium
    ;;
  customer)
    echo -e "${GREEN}🧪 Running Customer Booking Tests...${NC}"
    npx playwright test --project=customer-booking --project=customer-chromium
    ;;
  delivery)
    echo -e "${GREEN}🧪 Running Home Delivery Tests...${NC}"
    npx playwright test --project=home-delivery
    ;;
  problem)
    echo -e "${GREEN}🧪 Running Problem Grid Tests...${NC}"
    npx playwright test --project=problem-grid
    ;;
  admin)
    echo -e "${GREEN}🧪 Running Admin Tests...${NC}"
    npx playwright test --project=admin-chromium
    ;;
  api)
    echo -e "${GREEN}🧪 Running API Tests...${NC}"
    npx playwright test --project=api
    ;;
  quick)
    echo -e "${GREEN}🧪 Running Quick Smoke Tests...${NC}"
    npx playwright test --grep="@smoke" --project=customer-chromium --project=vendor-chromium
    ;;
  full|all)
    echo -e "${GREEN}🧪 Running Full Test Suite...${NC}"
    npx playwright test
    ;;
  *)
    echo -e "${GREEN}🧪 Running All Business Flow Tests...${NC}"
    npx playwright test --project=vendor-onboarding --project=customer-booking --project=home-delivery --project=problem-grid
    ;;
esac

# Check test results
TEST_EXIT_CODE=$?

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   TEST RESULTS                                                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
else
  echo -e "${RED}❌ Some tests failed. Check the report for details.${NC}"
fi

echo ""
echo -e "${BLUE}📊 Reports Generated:${NC}"
echo -e "   HTML Report: $REPORT_DIR/html-report/index.html"
echo -e "   JSON Report: $REPORT_DIR/results.json"
echo -e "   JUnit Report: $REPORT_DIR/junit.xml"
echo ""

# Generate summary report
echo -e "${BLUE}📝 Generating Summary Report...${NC}"

if [ -f "$REPORT_DIR/results.json" ]; then
  # Parse results and create summary
  node -e "
    const fs = require('fs');
    const results = JSON.parse(fs.readFileSync('$REPORT_DIR/results.json', 'utf8'));
    
    const stats = results.stats || {};
    const suites = results.suites || [];
    
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    
    function countTests(suite) {
      if (suite.specs) {
        suite.specs.forEach(spec => {
          totalTests++;
          if (spec.ok) passedTests++;
          else if (spec.tests && spec.tests[0]?.status === 'skipped') skippedTests++;
          else failedTests++;
        });
      }
      if (suite.suites) {
        suite.suites.forEach(countTests);
      }
    }
    
    suites.forEach(countTests);
    
    const summary = {
      timestamp: new Date().toISOString(),
      environment: {
        customerUrl: process.env.CUSTOMER_URL || 'https://d2aoyjj8ine0wk.cloudfront.net',
        vendorUrl: process.env.VENDOR_URL || 'https://d1s6ykkj381k58.cloudfront.net',
        adminUrl: process.env.ADMIN_URL || 'https://dfof7mguaa0a5.cloudfront.net',
      },
      results: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        skipped: skippedTests,
        passRate: totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) + '%' : '0%'
      },
      duration: stats.duration || 0
    };
    
    fs.writeFileSync('$REPORT_DIR/summary.json', JSON.stringify(summary, null, 2));
    
    console.log('');
    console.log('📈 Test Summary:');
    console.log('   Total Tests: ' + summary.results.total);
    console.log('   ✅ Passed: ' + summary.results.passed);
    console.log('   ❌ Failed: ' + summary.results.failed);
    console.log('   ⏭️  Skipped: ' + summary.results.skipped);
    console.log('   📊 Pass Rate: ' + summary.results.passRate);
    console.log('   ⏱️  Duration: ' + (summary.duration / 1000).toFixed(2) + 's');
  " 2>/dev/null || echo "   (Could not parse results)"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   E2E TEST RUN COMPLETE                                        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"

# Open HTML report (optional)
if [ "$OPEN_REPORT" = "true" ]; then
  echo -e "${BLUE}🌐 Opening HTML report...${NC}"
  open "$REPORT_DIR/html-report/index.html" 2>/dev/null || xdg-open "$REPORT_DIR/html-report/index.html" 2>/dev/null || echo "Please open $REPORT_DIR/html-report/index.html manually"
fi

exit $TEST_EXIT_CODE
