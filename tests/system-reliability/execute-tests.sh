#!/bin/bash
# WARMPAWZ SYSTEM RELIABILITY TEST SUITE - EXECUTION SCRIPT

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  WARMPAWZ SYSTEM RELIABILITY TEST SUITE                     ║"
echo "║  100 Complex Real-World Test Journeys                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if API server is running
echo "🔍 Checking if API server is running..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ API server is running on http://localhost:3000"
else
    echo "❌ API server is not running!"
    echo ""
    echo "Please start the API server first:"
    echo "  cd backend/lambda"
    echo "  npm run start:local"
    echo ""
    echo "Wait for: 'Offline [http for lambda] http://localhost:3000'"
    echo ""
    exit 1
fi

# Set environment variables
export API_ENDPOINT=${API_ENDPOINT:-http://localhost:3000}
export NODE_ENV=test

echo "📝 API Endpoint: $API_ENDPOINT"
echo ""

# Change to test directory
cd "$(dirname "$0")"

# Check if TypeScript is available
if ! command -v ts-node &> /dev/null; then
    echo "⚠️  ts-node not found. Installing dependencies..."
    npm install --save-dev ts-node typescript @types/node
fi

# Execute tests
echo "🚀 Starting test execution..."
echo ""

ts-node run-tests.ts

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ ALL TESTS PASSED - SYSTEM IS UAT-READY"
else
    echo ""
    echo "❌ SOME TESTS FAILED - REVIEW REPORT"
fi

exit $EXIT_CODE
