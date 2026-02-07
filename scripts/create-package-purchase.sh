#!/bin/bash
# Create a test package purchase via API
# Usage: ./scripts/create-package-purchase.sh [phone] [vendorId] [packageId]

set -euo pipefail

API_BASE="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
TEST_PHONE="${1:-9876543210}"
VENDOR_ID="${2:-4dd488a2-54a9-4246-80b4-8b3e28636998}"
PACKAGE_ID="${3:-}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}📦 Creating Test Package Purchase${NC}"
echo "======================================================================"

# Get customer ID
CUSTOMER_RESPONSE=$(curl -s "${API_BASE}/customer/profile?phone=${TEST_PHONE}")
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CUSTOMER_ID" ]; then
    echo -e "${RED}❌ Customer not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Customer ID: ${CUSTOMER_ID}${NC}"

# If no package ID provided, try to discover packages
if [ -z "$PACKAGE_ID" ]; then
    echo -e "${BLUE}Discovering available packages...${NC}"
    PACKAGES_RESPONSE=$(curl -s "${API_BASE}/packages/discover?vendorId=${VENDOR_ID}")
    echo "$PACKAGES_RESPONSE" | head -20
    
    echo ""
    echo -e "${YELLOW}⚠️  No package ID provided. Please provide a package ID or create one first.${NC}"
    echo ""
    echo -e "${BLUE}Alternative: Create package purchase directly in database:${NC}"
    cat <<EOF

INSERT INTO package_purchases (
    purchase_id,
    package_id,
    customer_id,
    vendor_id,
    package_name,
    package_type,
    package_price,
    amount,
    total_sessions,
    remaining_sessions,
    status,
    payment_status,
    expires_at,
    created_at,
    updated_at
) VALUES (
    'pur_test_' || extract(epoch from now())::text,
    gen_random_uuid(),
    '${CUSTOMER_ID}',
    '${VENDOR_ID}',
    '5 Session Vet Package',
    'appointment',
    2499.00,
    2499.00,
    5,
    3,
    'active',
    'completed',
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
);

EOF
    exit 0
fi

# Try to enroll in package
echo -e "${BLUE}Enrolling in package: ${PACKAGE_ID}${NC}"
ENROLL_DATA=$(cat <<EOF
{
  "customerId": "${CUSTOMER_ID}",
  "vendorId": "${VENDOR_ID}"
}
EOF
)

ENROLL_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$ENROLL_DATA" \
    "${API_BASE}/packages/${PACKAGE_ID}/enroll")

echo "$ENROLL_RESPONSE" | head -20

if echo "$ENROLL_RESPONSE" | grep -q "success\|id"; then
    echo -e "${GREEN}✅ Package purchase created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create package purchase${NC}"
    echo "$ENROLL_RESPONSE"
    exit 1
fi
