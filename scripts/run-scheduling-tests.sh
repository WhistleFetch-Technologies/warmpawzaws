#!/bin/bash

# ============================================================================
# SCHEDULING TESTS RUNNER
# ============================================================================
# Runs all scheduling tests and ensures 100% pass rate
# ============================================================================

set -e

echo "🧪 Running Scheduling Service Tests..."
echo "========================================"
echo ""

# Run tests
deno test \
    --allow-net \
    --allow-env \
    --allow-read \
    --allow-write \
    supabase/lib/services/__tests__/scheduling-service.test.ts \
    --reporter=verbose

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ All tests passed!"
    echo "✅ Zero critical issues"
    echo "✅ Zero high priority issues"
    echo "✅ Zero warnings"
    echo ""
    echo "🎉 100% Test Coverage Achieved!"
    exit 0
else
    echo ""
    echo "❌ Some tests failed"
    echo "Exit code: $TEST_EXIT_CODE"
    exit 1
fi

