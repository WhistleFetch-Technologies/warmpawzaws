#!/bin/bash

# Comprehensive Scheduling Tests
# Tests all flows: centre, staff, distance, commute, subscriptions, packages, emergency, concurrent

set -e

echo "🧪 Running Comprehensive Scheduling Tests..."
echo ""

# Run tests
deno test supabase/lib/services/__tests__/scheduling-complete.test.ts --allow-all 2>&1 | tee /tmp/scheduling-test-results.txt

# Check results
if grep -q "✅ All scheduling tests completed" /tmp/scheduling-test-results.txt; then
    echo ""
    echo "✅ All scheduling tests passed!"
    exit 0
else
    echo ""
    echo "❌ Some tests failed"
    exit 1
fi

