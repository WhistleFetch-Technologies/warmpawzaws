#!/bin/bash

# Run loyalty migration via API endpoint (if available)
# Otherwise provides instructions for manual migration

set -e

API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

echo "========================================="
echo "Loyalty Migration Runner"
echo "========================================="
echo ""

# Check if migration endpoint exists
echo "Checking for migration endpoint..."
MIGRATION_RESPONSE=$(curl -s -X POST "$API_BASE_URL/admin/migrations/run" \
  -H "Content-Type: application/json" \
  -d '{"migration": "043_loyalty_action_rules_table"}' 2>&1)

if echo "$MIGRATION_RESPONSE" | grep -q "success\|completed"; then
    echo "✅ Migration completed via API"
    exit 0
else
    echo "⚠️  Migration endpoint not available or failed"
    echo ""
    echo "Please run migration manually:"
    echo ""
    echo "1. Get database credentials from AWS SSM:"
    echo "   aws ssm get-parameters --names \\"
    echo "     /warmpawz/dev/db/host \\"
    echo "     /warmpawz/dev/db/name \\"
    echo "     /warmpawz/dev/db/user \\"
    echo "     /warmpawz/dev/db/password --with-decryption --region ap-south-1"
    echo ""
    echo "2. Run migration:"
    echo "   psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> \\"
    echo "     -f db/migrations/043_loyalty_action_rules_table.sql"
    echo ""
    exit 1
fi
