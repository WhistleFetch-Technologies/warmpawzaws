#!/bin/bash

# Systematic Testing Script Runner
# This script runs the complete systematic test with API calls and flow tracing

set -e

echo "🧪 Systematic Testing for Groomer & Trainer Booking Flows"
echo "=========================================================="
echo ""

# Check if API_BASE_URL is set
if [ -z "$API_BASE_URL" ]; then
  echo "⚠️  API_BASE_URL not set, using default: http://localhost:3001"
  export API_BASE_URL="http://localhost:3001"
fi

# Check if TEST_CUSTOMER_PHONE is set
if [ -z "$TEST_CUSTOMER_PHONE" ]; then
  echo "⚠️  TEST_CUSTOMER_PHONE not set, using default: +919876543210"
  export TEST_CUSTOMER_PHONE="+919876543210"
fi

echo "📋 Configuration:"
echo "   API Base URL: $API_BASE_URL"
echo "   Test Customer Phone: $TEST_CUSTOMER_PHONE"
echo ""

# Check if API is accessible
echo "🔍 Checking API connectivity..."
if curl -s --max-time 5 "$API_BASE_URL/health" > /dev/null 2>&1 || curl -s --max-time 5 "$API_BASE_URL" > /dev/null 2>&1; then
  echo "✅ API is accessible"
else
  echo "⚠️  Warning: API may not be accessible at $API_BASE_URL"
  echo "   Continuing anyway..."
fi

echo ""
echo "🚀 Starting systematic tests..."
echo ""

# Run the TypeScript test
npx tsx scripts/test-groomer-trainer-systematic.ts

echo ""
echo "✅ Test execution completed!"
echo ""
echo "📊 Results:"
echo "   - Detailed JSON: groomer-trainer-systematic-test-results.json"
echo "   - Complete Trace: groomer-trainer-test-trace.md"
echo ""
