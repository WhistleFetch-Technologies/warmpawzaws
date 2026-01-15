#!/bin/bash
# Create test data for package booking, GPS tracking, and training via API
# Usage: ./scripts/create-test-data-via-api.sh [phone] [vendorId]

set -euo pipefail

API_BASE="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
TEST_PHONE="${1:-9876543210}"
VENDOR_ID="${2:-4dd488a2-54a9-4246-80b4-8b3e28636998}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🧪 Creating Test Data via API${NC}"
echo "======================================================================"
echo -e "API Base: ${YELLOW}${API_BASE}${NC}"
echo -e "Test Phone: ${YELLOW}${TEST_PHONE}${NC}"
echo -e "Vendor ID: ${YELLOW}${VENDOR_ID}${NC}"
echo ""

# Get customer ID
echo -e "${BLUE}1. Getting customer ID...${NC}"
CUSTOMER_RESPONSE=$(curl -s "${API_BASE}/customer/profile?phone=${TEST_PHONE}")
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CUSTOMER_ID" ]; then
    echo -e "${RED}❌ Customer not found. Please create customer first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Customer ID: ${CUSTOMER_ID}${NC}"
echo ""

# Get a pet ID
echo -e "${BLUE}2. Getting pet ID...${NC}"
PETS_RESPONSE=$(curl -s "${API_BASE}/customer/pets/${TEST_PHONE}")
PET_ID=$(echo "$PETS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PET_ID" ]; then
    echo -e "${YELLOW}⚠️  No pets found. Creating a test pet...${NC}"
    # Create a test pet
    PET_DATA=$(cat <<EOF
{
  "name": "Test Pet",
  "species": "dog",
  "breed": "Golden Retriever",
  "age": 2,
  "gender": "male"
}
EOF
)
    PET_RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$PET_DATA" \
        "${API_BASE}/customer/${CUSTOMER_ID}/pets")
    PET_ID=$(echo "$PET_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -z "$PET_ID" ]; then
        echo -e "${RED}❌ Failed to create pet${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Created pet: ${PET_ID}${NC}"
else
    echo -e "${GREEN}✅ Pet ID: ${PET_ID}${NC}"
fi
echo ""

# Note: Package purchases typically need to be created via admin or vendor endpoints
# For now, we'll document what needs to be created
echo -e "${BLUE}3. Test Data Requirements:${NC}"
echo ""
echo -e "${YELLOW}📋 To test package booking, you need:${NC}"
echo "   - A package purchase in the database"
echo "   - Table: package_purchases"
echo "   - Fields: customer_id, vendor_id, package_name, total_sessions, remaining_sessions, status='active'"
echo ""
echo -e "${YELLOW}📋 To test GPS tracking, you need:${NC}"
echo "   - An active booking for walk service"
echo "   - A walker_live_sessions entry with is_active=true"
echo ""
echo -e "${YELLOW}📋 To test training progress, you need:${NC}"
echo "   - A training package purchase"
echo "   - Training skills in training_skills table"
echo "   - Pet skill progress in pet_skill_progress table"
echo ""

echo -e "${BLUE}💡 Creating test data via SQL (if database access available):${NC}"
cat <<EOF

-- 1. Create a test package purchase
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
    expires_at
) VALUES (
    'pur_test_' || extract(epoch from now())::text,
    gen_random_uuid(), -- or actual package_id if exists
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
    NOW() + INTERVAL '30 days'
) ON CONFLICT DO NOTHING;

-- 2. Create an active walk session (requires a booking first)
-- First create a booking for walk service, then:
INSERT INTO walker_live_sessions (
    booking_id,
    walker_id,
    customer_id,
    current_lat,
    current_lng,
    is_active,
    started_at
) VALUES (
    '<booking_id>', -- Replace with actual booking ID
    '${VENDOR_ID}',
    '${CUSTOMER_ID}',
    19.0760,
    72.8777,
    true,
    NOW()
) ON CONFLICT DO NOTHING;

-- 3. Create training skills and progress
INSERT INTO training_skills (name, description, category) VALUES
    ('Sit', 'Dog sits on command', 'basic'),
    ('Stay', 'Dog stays in position', 'basic'),
    ('Come', 'Dog comes when called', 'basic')
ON CONFLICT DO NOTHING;

-- Then create progress for pet
INSERT INTO pet_skill_progress (
    pet_id,
    customer_id,
    vendor_id,
    skill_id,
    progress_level,
    status
) VALUES (
    '${PET_ID}',
    '${CUSTOMER_ID}',
    '${VENDOR_ID}',
    (SELECT id FROM training_skills WHERE name = 'Sit' LIMIT 1),
    75,
    'in_progress'
) ON CONFLICT DO NOTHING;

EOF

echo ""
echo -e "${GREEN}✅ Test data creation guide generated${NC}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "   1. Run the SQL commands above (if database access available)"
echo "   2. Or use admin/vendor endpoints to create packages"
echo "   3. Then test the flows in the browser"
echo ""
