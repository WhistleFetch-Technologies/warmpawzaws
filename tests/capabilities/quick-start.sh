#!/bin/bash

# Quick Start Script for Capability Testing
# This script provides an interactive menu to run tests

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Capability Testing - Quick Start${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "test-capability-role-alignment.ts" ]; then
    echo -e "${YELLOW}⚠ Warning: Test scripts not found in current directory${NC}"
    echo "Please run this script from tests/capabilities/ directory"
    exit 1
fi

# Create reports directory if it doesn't exist
mkdir -p ../../test-reports

# Function to run a test
run_test() {
    local test_name=$1
    local script_name=$2
    local timestamp=$(date +%Y%m%d_%H%M%S)
    
    echo -e "\n${GREEN}Running: $test_name${NC}"
    echo "Script: $script_name"
    echo "Output: ../../test-reports/${test_name}-${timestamp}.txt"
    echo ""
    
    npx ts-node "$script_name" > "../../test-reports/${test_name}-${timestamp}.txt" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Test completed successfully${NC}"
        echo "Results saved to: ../../test-reports/${test_name}-${timestamp}.txt"
    else
        echo -e "${YELLOW}⚠ Test completed with warnings/errors${NC}"
        echo "Check: ../../test-reports/${test_name}-${timestamp}.txt"
    fi
}

# Menu
echo "Select test to run:"
echo ""
echo "1) Test Role-Capability Alignment"
echo "2) Test Capability Enforcement"
echo "3) Analyze Capability Alignment"
echo "4) Run All Tests"
echo "5) View Test Reports"
echo "6) Exit"
echo ""
read -p "Enter choice [1-6]: " choice

case $choice in
    1)
        run_test "role-alignment" "test-capability-role-alignment.ts"
        ;;
    2)
        run_test "enforcement" "test-capability-enforcement.ts"
        ;;
    3)
        run_test "analysis" "analyze-capability-alignment.ts"
        ;;
    4)
        echo -e "\n${GREEN}Running all tests...${NC}\n"
        run_test "role-alignment" "test-capability-role-alignment.ts"
        run_test "enforcement" "test-capability-enforcement.ts"
        run_test "analysis" "analyze-capability-alignment.ts"
        echo -e "\n${GREEN}All tests completed!${NC}"
        ;;
    5)
        echo -e "\n${BLUE}Recent test reports:${NC}"
        ls -lth ../../test-reports/*.txt 2>/dev/null | head -10 || echo "No test reports found"
        echo ""
        read -p "Enter report filename to view (or press Enter to skip): " report_file
        if [ -n "$report_file" ]; then
            if [ -f "../../test-reports/$report_file" ]; then
                less "../../test-reports/$report_file"
            else
                echo "File not found: $report_file"
            fi
        fi
        ;;
    6)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice. Exiting..."
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
