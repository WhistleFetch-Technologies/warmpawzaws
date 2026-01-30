#!/bin/bash

# Complete Booking Lifecycle Test Script for Groomer & Trainer Services
# This script runs the TypeScript test and provides a summary

set -e

echo "🚀 Starting Groomer & Trainer Booking Lifecycle Tests"
echo "=================================================="
echo ""

# Check if API_BASE_URL is set
if [ -z "$API_BASE_URL" ]; then
  echo "⚠️  API_BASE_URL not set, using default: http://localhost:3001"
  export API_BASE_URL="http://localhost:3001"
fi

# Check if test customer phone is set
if [ -z "$TEST_CUSTOMER_PHONE" ]; then
  echo "⚠️  TEST_CUSTOMER_PHONE not set, using default: +919876543210"
  export TEST_CUSTOMER_PHONE="+919876543210"
fi

echo "📋 Configuration:"
echo "   API Base URL: $API_BASE_URL"
echo "   Test Customer Phone: $TEST_CUSTOMER_PHONE"
echo ""

# Run the TypeScript test
echo "🔄 Running tests..."
npx tsx scripts/test-groomer-trainer-booking-lifecycle.ts

echo ""
echo "✅ Test execution completed!"
echo "📊 Check groomer-trainer-booking-test-results.json for detailed results"
