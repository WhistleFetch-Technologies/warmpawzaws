#!/bin/bash
# Test Runner Script for Booking System Fixes
# Usage: ./run-all-tests.sh [test-name]

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Automated Test Suite - Booking System Fixes${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

# Check if axios is installed
if ! npm list axios >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  axios not found. Installing...${NC}"
  npm install axios --save-dev
fi

# Check if ts-node is available
if ! command -v npx &> /dev/null; then
  echo -e "${RED}❌ npx not found. Please install Node.js and npm.${NC}"
  exit 1
fi

# Test functions
run_test() {
  local test_file=$1
  local test_name=$2
  
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Running: ${test_name}${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  
  if [ -f "$test_file" ]; then
    npx ts-node "$test_file"
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
      echo -e "\n${GREEN}✅ ${test_name} completed${NC}"
      return 0
    else
      echo -e "\n${RED}❌ ${test_name} failed with exit code ${exit_code}${NC}"
      return 1
    fi
  else
    echo -e "${RED}❌ Test file not found: ${test_file}${NC}"
    return 1
  fi
}

# Run specific test or all tests
if [ -n "$1" ]; then
  case "$1" in
    "slot-blocking"|"1")
      run_test "test-booking-slot-blocking.ts" "Test 1: Slot Blocking"
      ;;
    "error-handling"|"409"|"2")
      run_test "test-error-handling-409.ts" "Test 2: Error Handling (409)"
      ;;
    "multiple-services"|"3")
      run_test "test-multiple-services.ts" "Test 3: Multiple Services"
      ;;
    *)
      echo -e "${RED}❌ Unknown test: $1${NC}"
      echo -e "${YELLOW}Available tests:${NC}"
      echo -e "  slot-blocking, 1    - Test slot blocking logic"
      echo -e "  error-handling, 409, 2 - Test 409 error handling"
      echo -e "  multiple-services, 3   - Test multiple services payload"
      exit 1
      ;;
  esac
else
  # Run all tests
  TOTAL_TESTS=0
  PASSED_TESTS=0
  FAILED_TESTS=0
  
  # Test 1: Slot Blocking
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  if run_test "test-booking-slot-blocking.ts" "Test 1: Slot Blocking"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  
  # Test 2: Error Handling
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  if run_test "test-error-handling-409.ts" "Test 2: Error Handling (409)"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  
  # Test 3: Multiple Services
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  if run_test "test-multiple-services.ts" "Test 3: Multiple Services"; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  
  # Summary
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  Test Suite Summary${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}✅ Passed: ${PASSED_TESTS}${NC}"
  echo -e "${RED}❌ Failed: ${FAILED_TESTS}${NC}"
  echo -e "${BLUE}📊 Total:  ${TOTAL_TESTS}${NC}"
  
  if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}\n"
    exit 0
  else
    echo -e "\n${RED}⚠️  Some tests failed. Please review the output above.${NC}\n"
    exit 1
  fi
fi
