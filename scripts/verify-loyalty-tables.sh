#!/bin/bash

# Verify and create loyalty tables if needed
# This script checks if loyalty_action_rules table exists and creates it if missing

set -e

API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

echo "========================================="
echo "Verifying Loyalty Tables"
echo "========================================="
echo ""

# Test if table exists by trying to query it
echo "Testing if loyalty_action_rules table exists..."
RESPONSE=$(curl -s -X GET "$API_BASE_URL/admin/loyalty-action-rules" \
  -H "Content-Type: application/json" 2>&1)

if echo "$RESPONSE" | grep -q "success.*true"; then
    echo "✅ Table exists and is accessible"
    echo "Response: $RESPONSE" | head -3
    exit 0
elif echo "$RESPONSE" | grep -q "does not exist\|relation.*does not exist"; then
    echo "❌ Table does not exist"
    echo ""
    echo "Migration required. Please run:"
    echo "  psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f db/migrations/043_loyalty_action_rules_table.sql"
    echo ""
    echo "Or use the migration endpoint if available."
    exit 1
else
    echo "⚠️  Unknown response. Table status unclear."
    echo "Response: $RESPONSE"
    echo ""
    echo "This might indicate:"
    echo "  1. Table doesn't exist"
    echo "  2. Database connection issue"
    echo "  3. Permission issue"
    exit 1
fi
