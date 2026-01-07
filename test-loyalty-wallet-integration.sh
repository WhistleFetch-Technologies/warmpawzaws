#!/bin/bash

# ============================================================================
# Loyalty & Wallet Integration Test Script
# ============================================================================
# 
# Tests the complete loyalty, referral, and wallet integration
# 
# Usage: ./test-loyalty-wallet-integration.sh [API_BASE_URL]
# 
# Example: ./test-loyalty-wallet-integration.sh https://api.warmpawz.com
# ============================================================================

set -e

API_BASE_URL="${1:-http://localhost:3000}"
CUSTOMER_ID=""
VENDOR_ID=""
BOOKING_ID=""
ORDER_ID=""
PAYMENT_ID=""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Loyalty & Wallet Integration Tests"
echo "=========================================="
echo "API Base URL: $API_BASE_URL"
echo ""

# ============================================================================
# Helper Functions
# ============================================================================

test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=${4:-200}
    
    echo -n "Testing $method $endpoint... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} (Status: $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 0
    else
        echo -e "${RED}✗${NC} (Expected: $expected_status, Got: $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 1
    fi
}

# ============================================================================
# Test 1: Customer Signup (Should award 100 points)
# ============================================================================

echo "Test 1: Customer Signup"
echo "----------------------"

# Create test customer (simulating signup)
signup_response=$(curl -s -X POST "$API_BASE_URL/auth/verify-otp" \
    -H "Content-Type: application/json" \
    -d '{
        "phone": "+919876543210",
        "otp": "123456",
        "role": "customer"
    }')

CUSTOMER_ID=$(echo "$signup_response" | jq -r '.customerId // .customer.id // empty')

if [ -z "$CUSTOMER_ID" ] || [ "$CUSTOMER_ID" = "null" ]; then
    echo -e "${YELLOW}⚠ Could not extract customer ID, using test ID${NC}"
    CUSTOMER_ID="test-customer-$(date +%s)"
else
    echo -e "${GREEN}✓ Customer created: $CUSTOMER_ID${NC}"
fi

# Check loyalty profile
echo ""
echo "Checking loyalty profile..."
test_endpoint "GET" "/loyalty/profile/$CUSTOMER_ID"

# Check wallet balance
echo ""
echo "Checking wallet balance..."
test_endpoint "GET" "/wallet/$CUSTOMER_ID"

echo ""

# ============================================================================
# Test 2: Complete Pet Profile (Should award 100 points)
# ============================================================================

echo "Test 2: Complete Pet Profile"
echo "-----------------------------"

if [ -n "$CUSTOMER_ID" ]; then
    pet_data=$(cat <<EOF
{
    "name": "Buddy",
    "species": "dog",
    "breed": "Golden Retriever",
    "age": 2,
    "gender": "male"
}
EOF
)
    
    echo "Creating pet profile..."
    test_endpoint "POST" "/customer/$CUSTOMER_ID/pets" "$pet_data"
    
    echo ""
    echo "Checking updated loyalty profile..."
    test_endpoint "GET" "/loyalty/profile/$CUSTOMER_ID"
    
    echo ""
    echo "Checking updated wallet balance..."
    test_endpoint "GET" "/wallet/$CUSTOMER_ID"
else
    echo -e "${YELLOW}⚠ Skipping - No customer ID${NC}"
fi

echo ""

# ============================================================================
# Test 3: Product Purchase (Should award points based on amount)
# ============================================================================

echo "Test 3: Product Purchase"
echo "-------------------------"

if [ -n "$CUSTOMER_ID" ]; then
    order_data=$(cat <<EOF
{
    "customerId": "$CUSTOMER_ID",
    "items": [
        {
            "productId": "test-product-1",
            "quantity": 1,
            "price": 5000,
            "name": "Premium Dog Food"
        }
    ],
    "paymentMethod": "online"
}
EOF
)
    
    echo "Creating order..."
    order_response=$(curl -s -X POST "$API_BASE_URL/ecommerce/orders" \
        -H "Content-Type: application/json" \
        -d "$order_data")
    
    ORDER_ID=$(echo "$order_response" | jq -r '.order.id // .orderId // empty')
    
    if [ -n "$ORDER_ID" ] && [ "$ORDER_ID" != "null" ]; then
        echo -e "${GREEN}✓ Order created: $ORDER_ID${NC}"
        
        echo ""
        echo "Checking loyalty points after purchase..."
        test_endpoint "GET" "/loyalty/profile/$CUSTOMER_ID"
        
        echo ""
        echo "Checking wallet balance after purchase..."
        test_endpoint "GET" "/wallet/$CUSTOMER_ID"
    else
        echo -e "${YELLOW}⚠ Could not create order${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping - No customer ID${NC}"
fi

echo ""

# ============================================================================
# Test 4: Wallet Payment
# ============================================================================

echo "Test 4: Wallet Payment"
echo "----------------------"

if [ -n "$CUSTOMER_ID" ]; then
    # First, check current wallet balance
    wallet_response=$(curl -s -X GET "$API_BASE_URL/wallet/$CUSTOMER_ID")
    wallet_balance=$(echo "$wallet_response" | jq -r '.balance // 0')
    
    echo "Current wallet balance: ₹$wallet_balance"
    
    if (( $(echo "$wallet_balance > 0" | bc -l) )); then
        # Create a test booking
        booking_data=$(cat <<EOF
{
    "customerId": "$CUSTOMER_ID",
    "vendorId": "test-vendor-1",
    "serviceId": "test-service-1",
    "bookingDate": "$(date -u +%Y-%m-%d)",
    "bookingTime": "10:00",
    "price": 1000
}
EOF
)
        
        booking_response=$(curl -s -X POST "$API_BASE_URL/bookings" \
            -H "Content-Type: application/json" \
            -d "$booking_data")
        
        BOOKING_ID=$(echo "$booking_response" | jq -r '.booking.id // .bookingId // empty')
        
        if [ -n "$BOOKING_ID" ] && [ "$BOOKING_ID" != "null" ]; then
            echo -e "${GREEN}✓ Booking created: $BOOKING_ID${NC}"
            
            # Pay using wallet
            payment_data=$(cat <<EOF
{
    "bookingId": "$BOOKING_ID",
    "amount": 500,
    "paymentMethod": "razorpay",
    "useWallet": true,
    "walletAmount": 500,
    "customerId": "$CUSTOMER_ID"
}
EOF
)
            
            echo ""
            echo "Processing wallet payment..."
            payment_response=$(curl -s -X POST "$API_BASE_URL/payments/create" \
                -H "Content-Type: application/json" \
                -d "$payment_data")
            
            PAYMENT_ID=$(echo "$payment_response" | jq -r '.paymentId // .payment.id // empty')
            
            if [ -n "$PAYMENT_ID" ] && [ "$PAYMENT_ID" != "null" ]; then
                echo -e "${GREEN}✓ Payment processed: $PAYMENT_ID${NC}"
                echo "$payment_response" | jq '.'
                
                echo ""
                echo "Checking wallet balance after payment..."
                test_endpoint "GET" "/wallet/$CUSTOMER_ID"
            else
                echo -e "${YELLOW}⚠ Could not process payment${NC}"
            fi
        else
            echo -e "${YELLOW}⚠ Could not create booking${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Insufficient wallet balance for payment test${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping - No customer ID${NC}"
fi

echo ""

# ============================================================================
# Test 5: Admin - Get Loyalty Action Rules
# ============================================================================

echo "Test 5: Admin - Loyalty Action Rules"
echo "-------------------------------------"

test_endpoint "GET" "/admin/loyalty-action-rules"

echo ""

# ============================================================================
# Test 6: Admin - Create Custom Rule
# ============================================================================

echo "Test 6: Admin - Create Custom Rule"
echo "-----------------------------------"

rule_data=$(cat <<EOF
{
    "action_name": "test_custom_action",
    "action_category": "loyalty",
    "user_type": "customer",
    "points_type": "fixed",
    "points_value": 50,
    "frequency_type": "unlimited",
    "is_active": true,
    "priority": 100,
    "description": "Test custom action"
}
EOF
)

echo "Creating custom rule..."
test_endpoint "POST" "/admin/loyalty-action-rules" "$rule_data"

echo ""

# ============================================================================
# Summary
# ============================================================================

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Customer ID: $CUSTOMER_ID"
echo "Booking ID: $BOOKING_ID"
echo "Order ID: $ORDER_ID"
echo "Payment ID: $PAYMENT_ID"
echo ""
echo -e "${GREEN}Tests completed!${NC}"
echo ""

