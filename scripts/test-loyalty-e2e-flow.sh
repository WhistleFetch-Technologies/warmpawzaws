#!/bin/bash

# E2E Test: Loyalty System with Segmentation
# Simulates complete user journey: Create rules → Create segments → Create vendor → Complete transaction → Verify points

# Don't exit on error - we want to see all test results
set +e

API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
TEST_LOG="test-results/loyalty-e2e-$(date +%Y%m%d-%H%M%S).log"

mkdir -p test-results

echo "=========================================" | tee -a "$TEST_LOG"
echo "LOYALTY E2E TEST - Complete User Journey" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"
echo "API Base URL: $API_BASE_URL" | tee -a "$TEST_LOG"
echo "Started: $(date)" | tee -a "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"

# Pre-flight check: Verify table exists
echo "Pre-flight check: Verifying loyalty_action_rules table..." | tee -a "$TEST_LOG"
TABLE_CHECK=$(curl -s -X GET "$API_BASE_URL/admin/loyalty-action-rules" -H "Content-Type: application/json" 2>&1)
if echo "$TABLE_CHECK" | grep -q "does not exist\|relation.*does not exist"; then
    echo -e "${RED}❌ ERROR: loyalty_action_rules table does not exist${NC}" | tee -a "$TEST_LOG"
    echo "" | tee -a "$TEST_LOG"
    echo "Migration required. Please run:" | tee -a "$TEST_LOG"
    echo "  psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f db/migrations/043_loyalty_action_rules_table.sql" | tee -a "$TEST_LOG"
    echo "" | tee -a "$TEST_LOG"
    echo "Or get DB credentials from AWS SSM:" | tee -a "$TEST_LOG"
    echo "  aws ssm get-parameters --names /warmpawz/dev/db/host /warmpawz/dev/db/name /warmpawz/dev/db/user /warmpawz/dev/db/password --with-decryption --region ap-south-1" | tee -a "$TEST_LOG"
    exit 1
elif echo "$TABLE_CHECK" | grep -q "Failed to fetch"; then
    echo -e "${YELLOW}⚠️  WARNING: Could not verify table. Continuing anyway...${NC}" | tee -a "$TEST_LOG"
    echo "Response: $TABLE_CHECK" | tee -a "$TEST_LOG"
else
    echo -e "${GREEN}✅ Table check passed${NC}" | tee -a "$TEST_LOG"
fi
echo "" | tee -a "$TEST_LOG"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo "[TEST] $description" | tee -a "$TEST_LOG"
    echo "  → $method $endpoint" | tee -a "$TEST_LOG"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" 2>&1)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    echo "  ← HTTP $http_code" | tee -a "$TEST_LOG"
    echo "  ← Response: $body" | tee -a "$TEST_LOG"
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}  ✓ Success${NC}" | tee -a "$TEST_LOG"
        echo "$body"
        return 0
    else
        echo -e "${RED}  ✗ Failed (HTTP $http_code)${NC}" | tee -a "$TEST_LOG"
        echo -e "${YELLOW}  Response body: $body${NC}" | tee -a "$TEST_LOG"
        # Don't return 1 immediately - continue to see all errors
        echo "$body"
        return 1
    fi
}

# Extract JSON field
extract_field() {
    local json=$1
    local field=$2
    echo "$json" | grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed "s/.*\"$field\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/"
}

extract_field_id() {
    local json=$1
    local field=$2
    echo "$json" | grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed "s/.*\"$field\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/"
}

# ==========================================
# STEP 1: Create Loyalty Action Rule
# ==========================================
echo "" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"
echo "STEP 1: Create Loyalty Action Rule" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"

# Use buy_product action name (matches what order creation uses)
# Get existing rule instead of creating new one
ACTION_NAME="buy_product"
echo "Fetching existing rule: $ACTION_NAME" | tee -a "$TEST_LOG"

EXISTING_RULES_RESPONSE=$(api_call "GET" "/admin/loyalty-action-rules" "" "Get existing rules")
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to fetch existing rules${NC}" | tee -a "$TEST_LOG"
    exit 1
fi

# Extract the buy_product rule
RULE_RESPONSE=$(echo "$EXISTING_RULES_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    rules = data.get('rules', [])
    rule = next((r for r in rules if r.get('action_name') == '$ACTION_NAME'), None)
    if rule:
        print(json.dumps({'success': True, 'rule': [rule]}))
    else:
        print(json.dumps({'success': False, 'error': 'Rule not found'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
" 2>/dev/null)

if [ -z "$RULE_RESPONSE" ] || ! echo "$RULE_RESPONSE" | grep -q '"success".*true'; then
    echo -e "${RED}Failed to find buy_product rule. Creating new one...${NC}" | tee -a "$TEST_LOG"
    # Create new rule as fallback
    RULE_DATA='{"action_name":"buy_product","action_category":"loyalty","user_type":"customer","points_type":"per_amount","points_value":10,"base_amount":100,"frequency_type":"unlimited","is_active":true,"priority":200}'
    RULE_RESPONSE=$(api_call "POST" "/admin/loyalty-action-rules" "$RULE_DATA" "Create action rule")
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to create action rule${NC}" | tee -a "$TEST_LOG"
        exit 1
    fi
fi

RULE_ID=$(echo "$RULE_RESPONSE" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

if [ -z "$RULE_ID" ]; then
    # Try alternative extraction - check if response has rule array
    RULE_ID=$(echo "$RULE_RESPONSE" | grep -o '"rule"[^}]*"id"[^,}]*' | grep -o '"[^"]*"' | tail -1 | tr -d '"')
fi

if [ -z "$RULE_ID" ]; then
    # Try one more pattern - direct id in response
    RULE_ID=$(echo "$RULE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('rule', [{}])[0].get('id', '') if isinstance(data.get('rule'), list) else data.get('id', ''))" 2>/dev/null)
fi

if [ -z "$RULE_ID" ] || [ "$RULE_ID" = "None" ] || [ "$RULE_ID" = "null" ]; then
    echo -e "${RED}Failed to extract rule ID from response${NC}" | tee -a "$TEST_LOG"
    echo "Full response: $RULE_RESPONSE" | tee -a "$TEST_LOG"
    exit 1
fi

echo "Created Rule ID: $RULE_ID" | tee -a "$TEST_LOG"

# ==========================================
# STEP 2: Create Loyalty Segment
# ==========================================
echo "" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"
echo "STEP 2: Create Loyalty Segment" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"

SEGMENT_DATA='{
  "segment_name": "Test Customers - All",
  "segment_type": "customer",
  "description": "Test segment for E2E testing - matches all customers",
  "criteria": {
    "service_categories": []
  },
  "match_type": "all",
  "is_active": true,
  "priority": 100
}'

SEGMENT_RESPONSE=$(api_call "POST" "/admin/loyalty-segments" "$SEGMENT_DATA" "Create test segment")
SEGMENT_ID=$(echo "$SEGMENT_RESPONSE" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

if [ -z "$SEGMENT_ID" ]; then
    SEGMENT_ID=$(echo "$SEGMENT_RESPONSE" | grep -o '"segment"[^}]*"id"[^,}]*' | grep -o '"[^"]*"' | tail -1 | tr -d '"')
fi

if [ -z "$SEGMENT_ID" ]; then
    echo -e "${RED}Failed to extract segment ID from response${NC}" | tee -a "$TEST_LOG"
    echo "Full response: $SEGMENT_RESPONSE" | tee -a "$TEST_LOG"
    exit 1
fi

echo "Created Segment ID: $SEGMENT_ID" | tee -a "$TEST_LOG"

# ==========================================
# STEP 3: Link Segment to Rule
# ==========================================
echo "" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"
echo "STEP 3: Link Segment to Action Rule" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"

RULE_UPDATE_DATA="{
  \"action_name\": \"$ACTION_NAME\",
  \"action_category\": \"loyalty\",
  \"user_type\": \"customer\",
  \"points_type\": \"per_amount\",
  \"points_value\": 10,
  \"base_amount\": 100,
  \"frequency_type\": \"unlimited\",
  \"is_active\": true,
  \"priority\": 200,
  \"description\": \"Test rule: 10 points per ₹100 spent on products (E2E Test)\",
  \"conditions\": {
    \"segment_ids\": [\"$SEGMENT_ID\"]
  }
}"

api_call "PUT" "/admin/loyalty-action-rules/$RULE_ID" "$RULE_UPDATE_DATA" "Link segment to action rule"

# ==========================================
# STEP 4: Create Vendor
# ==========================================
echo "" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"
echo "STEP 4: Create Vendor" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"

VENDOR_DATA='{
  "businessName": "Test Pet Store E2E",
  "ownerName": "Test Owner",
  "email": "testvendor@warmpawz.test",
  "phone": "+919876543210",
  "category": "Pet Store",
  "services": ["Grooming", "Veterinary"],
  "address": "123 Test Street",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "tier": "Gold",
  "commission": "15",
  "status": "active"
}'

VENDOR_RESPONSE=$(api_call "POST" "/admin/vendors/create" "$VENDOR_DATA" "Create test vendor")
VENDOR_ID=$(echo "$VENDOR_RESPONSE" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

if [ -z "$VENDOR_ID" ]; then
    VENDOR_ID=$(echo "$VENDOR_RESPONSE" | grep -o '"vendor"[^}]*"id"[^,}]*' | grep -o '"[^"]*"' | tail -1 | tr -d '"')
fi

if [ -z "$VENDOR_ID" ]; then
    echo -e "${YELLOW}Warning: Could not extract vendor ID. Continuing with manual ID...${NC}" | tee -a "$TEST_LOG"
    VENDOR_ID="test-vendor-$(date +%s)"
fi

echo "Created/Using Vendor ID: $VENDOR_ID" | tee -a "$TEST_LOG"

# ==========================================
# STEP 5: Create Customer (if needed)
# ==========================================
echo "" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"
echo "STEP 5: Get/Create Test Customer" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"

CUSTOMER_PHONE="+919999999999"
CUSTOMER_DATA="{
  \"phone\": \"$CUSTOMER_PHONE\",
  \"name\": \"Test Customer E2E\",
  \"email\": \"testcustomer@warmpawz.test\"
}"

# Try to get existing customer or create
CUSTOMER_RESPONSE=$(api_call "POST" "/customer/create-or-get" "$CUSTOMER_DATA" "Get or create test customer" 2>&1 || echo "")
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

if [ -z "$CUSTOMER_ID" ]; then
    CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"customer"[^}]*"id"[^,}]*' | grep -o '"[^"]*"' | tail -1 | tr -d '"')
fi

if [ -z "$CUSTOMER_ID" ]; then
    echo -e "${YELLOW}Warning: Could not extract customer ID. Using test ID...${NC}" | tee -a "$TEST_LOG"
    CUSTOMER_ID="test-customer-$(date +%s)"
fi

echo "Using Customer ID: $CUSTOMER_ID" | tee -a "$TEST_LOG"

# ==========================================
# STEP 6: Create Product/Service
# ==========================================
echo "" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"
echo "STEP 6: Create Product for Order" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"

PRODUCT_DATA="{
  \"name\": \"Test Pet Food - E2E\",
  \"description\": \"Test product for loyalty E2E testing\",
  \"vendor_id\": \"$VENDOR_ID\",
  \"category_id\": \"test-category\",
  \"price\": 500,
  \"stock_quantity\": 100,
  \"is_active\": true
}"

PRODUCT_RESPONSE=$(api_call "POST" "/admin/catalog/products" "$PRODUCT_DATA" "Create test product" 2>&1 || echo "")
PRODUCT_ID=$(echo "$PRODUCT_RESPONSE" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

if [ -z "$PRODUCT_ID" ]; then
    echo -e "${YELLOW}Warning: Could not create product. Using test product ID...${NC}" | tee -a "$TEST_LOG"
    PRODUCT_ID="test-product-$(date +%s)"
fi

echo "Using Product ID: $PRODUCT_ID" | tee -a "$TEST_LOG"

# ==========================================
# STEP 7: Get Initial Loyalty Points
# ==========================================
echo "" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"
echo "STEP 7: Get Initial Loyalty Balance" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"

INITIAL_BALANCE_RESPONSE=$(api_call "GET" "/customer/$CUSTOMER_ID/rewards/points" "" "Get initial loyalty balance" 2>&1 || echo "")
INITIAL_POINTS=$(echo "$INITIAL_BALANCE_RESPONSE" | grep -o '"points"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | sed 's/.*"points"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/')

if [ -z "$INITIAL_POINTS" ]; then
    INITIAL_POINTS=0
fi

echo "Initial Points: $INITIAL_POINTS" | tee -a "$TEST_LOG"

# ==========================================
# STEP 8: Create Order (Simulate Purchase)
# ==========================================
echo "" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"
echo "STEP 8: Create Order (Simulate Purchase)" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"

ORDER_AMOUNT=500
ORDER_DATA="{
  \"customer_id\": \"$CUSTOMER_ID\",
  \"vendor_id\": \"$VENDOR_ID\",
  \"items\": [
    {
      \"product_id\": \"$PRODUCT_ID\",
      \"name\": \"Test Pet Food - E2E\",
      \"quantity\": 1,
      \"price\": $ORDER_AMOUNT
    }
  ],
  \"total_amount\": $ORDER_AMOUNT,
  \"payment_method\": \"test\",
  \"order_status\": \"completed\"
}"

ORDER_RESPONSE=$(api_call "POST" "/orders" "$ORDER_DATA" "Create test order" 2>&1 || echo "")
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Order creation failed, but continuing to check points...${NC}" | tee -a "$TEST_LOG"
    ORDER_ID=""
else
    ORDER_ID=$(echo "$ORDER_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('order', {}).get('id', '') or data.get('id', ''))" 2>/dev/null)
    
    if [ -z "$ORDER_ID" ]; then
        ORDER_ID=$(echo "$ORDER_RESPONSE" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    fi
    
    if [ -z "$ORDER_ID" ]; then
        ORDER_ID=$(echo "$ORDER_RESPONSE" | grep -o '"order"[^}]*"id"[^,}]*' | grep -o '"[^"]*"' | tail -1 | tr -d '"')
    fi
fi

if [ -n "$ORDER_ID" ]; then
    echo "Created Order ID: $ORDER_ID" | tee -a "$TEST_LOG"
else
    echo -e "${YELLOW}Warning: Could not extract order ID. Order may not have been created.${NC}" | tee -a "$TEST_LOG"
    echo "Order response: $ORDER_RESPONSE" | tee -a "$TEST_LOG"
fi

# Wait a bit for async processing
echo "Waiting 3 seconds for loyalty points processing..." | tee -a "$TEST_LOG"
sleep 3

# ==========================================
# STEP 9: Verify Points Were Awarded
# ==========================================
echo "" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"
echo "STEP 9: Verify Loyalty Points Awarded" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"

FINAL_BALANCE_RESPONSE=$(api_call "GET" "/customer/$CUSTOMER_ID/rewards/points" "" "Get final loyalty balance" 2>&1 || echo "")
FINAL_POINTS=$(echo "$FINAL_BALANCE_RESPONSE" | grep -o '"points"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | sed 's/.*"points"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/')

if [ -z "$FINAL_POINTS" ]; then
    FINAL_POINTS=0
fi

echo "Final Points: $FINAL_POINTS" | tee -a "$TEST_LOG"
POINTS_EARNED=$((FINAL_POINTS - INITIAL_POINTS))

echo "" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"
echo "TEST RESULTS" | tee -a "$TEST_LOG"
echo "=========================================" | tee -a "$TEST_LOG"
echo "Initial Points: $INITIAL_POINTS" | tee -a "$TEST_LOG"
echo "Final Points: $FINAL_POINTS" | tee -a "$TEST_LOG"
echo "Points Earned: $POINTS_EARNED" | tee -a "$TEST_LOG"
echo "" | tee -a "$TEST_LOG"

# Expected: 10 points per ₹100, so ₹500 = 50 points
EXPECTED_POINTS=50

if [ "$POINTS_EARNED" -ge "$EXPECTED_POINTS" ]; then
    echo -e "${GREEN}✓ SUCCESS: Points were awarded correctly!${NC}" | tee -a "$TEST_LOG"
    echo -e "${GREEN}  Expected: ~$EXPECTED_POINTS points, Got: $POINTS_EARNED points${NC}" | tee -a "$TEST_LOG"
    exit 0
else
    echo -e "${RED}✗ FAILED: Points were not awarded correctly${NC}" | tee -a "$TEST_LOG"
    echo -e "${RED}  Expected: ~$EXPECTED_POINTS points, Got: $POINTS_EARNED points${NC}" | tee -a "$TEST_LOG"
    echo "" | tee -a "$TEST_LOG"
    echo "Debugging info:" | tee -a "$TEST_LOG"
    echo "  Rule ID: $RULE_ID" | tee -a "$TEST_LOG"
    echo "  Segment ID: $SEGMENT_ID" | tee -a "$TEST_LOG"
    echo "  Customer ID: $CUSTOMER_ID" | tee -a "$TEST_LOG"
    echo "  Order ID: $ORDER_ID" | tee -a "$TEST_LOG"
    exit 1
fi
