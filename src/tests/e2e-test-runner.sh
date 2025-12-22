#!/bin/bash

# E2E Vendor Journey Test Runner
# Executes comprehensive end-to-end tests for all vendor roles

echo "🚀 Starting E2E Vendor Journey Tests..."
echo "========================================"
echo ""

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    echo "❌ Deno is not installed. Please install Deno first."
    echo "   Visit: https://deno.land/"
    exit 1
fi

# Run the test suite
echo "📋 Running test suites..."
echo ""

deno run --allow-net --allow-read --allow-write --allow-env \
  src/tests/e2e-vendor-journey-test.ts

TEST_EXIT_CODE=$?

echo ""
echo "========================================"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ Tests completed successfully!"
    echo ""
    echo "📄 Check E2E_VENDOR_JOURNEY_TEST_REPORT.txt for detailed results"
else
    echo "❌ Tests failed with exit code: $TEST_EXIT_CODE"
    echo ""
    echo "📄 Check E2E_VENDOR_JOURNEY_TEST_REPORT.txt for error details"
    exit $TEST_EXIT_CODE
fi

