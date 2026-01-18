#!/bin/bash
# Quick script to get latest test credentials

echo "🔍 Running test to get latest credentials..."
echo ""

npx tsx tests/vendor-complete-e2e.ts 2>&1 | grep -E "(Test Phone|Test Email|Vendor ID|Application ID|Service ID|Successful)" | head -10

echo ""
echo "📋 Copy the credentials above for manual testing"
