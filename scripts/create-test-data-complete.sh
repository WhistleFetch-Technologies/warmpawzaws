#!/bin/bash
# Complete test data creation script - creates package purchase via direct SQL approach
# Usage: ./scripts/create-test-data-complete.sh

set -euo pipefail

API_BASE="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
TEST_PHONE="9876543210"
VENDOR_ID="4dd488a2-54a9-4246-80b4-8b3e28636998"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🧪 Complete Test Data Creation${NC}"
echo "======================================================================"

# Get customer and pet IDs
echo -e "${BLUE}1. Getting customer and pet IDs...${NC}"
CUSTOMER_RESPONSE=$(curl -s "${API_BASE}/customer/profile?phone=${TEST_PHONE}")
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

PETS_RESPONSE=$(curl -s "${API_BASE}/customer/pets/${TEST_PHONE}")
PET_ID=$(echo "$PETS_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CUSTOMER_ID" ] || [ -z "$PET_ID" ]; then
    echo -e "${RED}❌ Failed to get customer or pet ID${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Customer ID: ${CUSTOMER_ID}${NC}"
echo -e "${GREEN}✅ Pet ID: ${PET_ID}${NC}"
echo ""

# Generate SQL script
SQL_FILE="/tmp/create_test_data_$(date +%s).sql"

cat > "$SQL_FILE" <<EOF
-- Test Data Creation Script
-- Generated: $(date)
-- Customer ID: ${CUSTOMER_ID}
-- Pet ID: ${PET_ID}
-- Vendor ID: ${VENDOR_ID}

-- 1. Create test package purchase
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
) ON CONFLICT (purchase_id) DO NOTHING
RETURNING id, purchase_id;

-- 2. Create training skills (if not exists)
INSERT INTO training_skills (name, description, category) VALUES
    ('Sit', 'Dog sits on command', 'basic'),
    ('Stay', 'Dog stays in position', 'basic'),
    ('Come', 'Dog comes when called', 'basic'),
    ('Down', 'Dog lies down on command', 'basic'),
    ('Heel', 'Dog walks beside owner', 'advanced')
ON CONFLICT DO NOTHING;

-- 3. Create pet skill progress
INSERT INTO pet_skill_progress (
    pet_id,
    customer_id,
    vendor_id,
    skill_id,
    progress_level,
    status,
    created_at,
    updated_at
) 
SELECT 
    '${PET_ID}',
    '${CUSTOMER_ID}',
    '${VENDOR_ID}',
    ts.id,
    CASE 
        WHEN ts.name = 'Sit' THEN 75
        WHEN ts.name = 'Stay' THEN 50
        WHEN ts.name = 'Come' THEN 60
        ELSE 30
    END,
    'in_progress',
    NOW(),
    NOW()
FROM training_skills ts
WHERE ts.name IN ('Sit', 'Stay', 'Come')
ON CONFLICT DO NOTHING;

-- 4. Verify data created
SELECT 'Package Purchases' as table_name, COUNT(*) as count FROM package_purchases WHERE customer_id = '${CUSTOMER_ID}'
UNION ALL
SELECT 'Training Skills', COUNT(*) FROM training_skills
UNION ALL
SELECT 'Pet Skill Progress', COUNT(*) FROM pet_skill_progress WHERE pet_id = '${PET_ID}';

EOF

echo -e "${GREEN}✅ SQL script generated: ${SQL_FILE}${NC}"
echo ""
echo -e "${BLUE}📋 SQL Script Contents:${NC}"
cat "$SQL_FILE"
echo ""
echo -e "${YELLOW}💡 To execute this SQL:${NC}"
echo "   1. Connect to RDS database"
echo "   2. Run: psql -h <rds-endpoint> -U <user> -d <database> -f ${SQL_FILE}"
echo ""
echo -e "${BLUE}📊 Or copy the SQL above and run it directly in your database client${NC}"
echo ""

# Also create a simplified version for quick copy-paste
echo -e "${BLUE}📝 Quick Copy-Paste SQL (Package Purchase Only):${NC}"
cat <<QUICK_SQL

INSERT INTO package_purchases (
    purchase_id, package_id, customer_id, vendor_id, package_name,
    package_type, package_price, amount, total_sessions, remaining_sessions,
    status, payment_status, expires_at, created_at, updated_at
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

QUICK_SQL

echo ""
echo -e "${GREEN}✅ Test data creation script ready!${NC}"
