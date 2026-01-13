#!/bin/bash
#================================================================
# TEST API DATA ENDPOINTS - Check if APIs return actual data
#================================================================

API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"

echo "🔍 TESTING API DATA RESPONSES"
echo "=============================="
echo ""

# Test endpoints that admin UI depends on
echo "📊 Testing Admin Data Endpoints..."
echo ""

echo "1. Vendors List:"
RESPONSE=$(curl -s "$API_URL/admin/vendors")
echo "$RESPONSE" | head -c 200
echo "..."
echo ""

echo "2. Customers List:"
RESPONSE=$(curl -s "$API_URL/admin/customers")
echo "$RESPONSE" | head -c 200
echo "..."
echo ""

echo "3. Bookings List:"
RESPONSE=$(curl -s "$API_URL/admin/bookings")
echo "$RESPONSE" | head -c 200
echo "..."
echo ""

echo "4. Services Catalog:"
RESPONSE=$(curl -s "$API_URL/services")
echo "$RESPONSE" | head -c 200
echo "..."
echo ""

echo "5. Roles:"
RESPONSE=$(curl -s "$API_URL/roles")
ROLE_COUNT=$(echo "$RESPONSE" | grep -o '"id"' | wc -l)
echo "Found $ROLE_COUNT roles"
echo ""

echo "6. Capabilities:"
RESPONSE=$(curl -s "$API_URL/admin/capabilities")
CAP_COUNT=$(echo "$RESPONSE" | grep -o '"id"' | wc -l)
echo "Found $CAP_COUNT capabilities"
echo ""

echo "7. GST Configs:"
RESPONSE=$(curl -s "$API_URL/admin/gst-configs")
echo "$RESPONSE" | head -c 200
echo "..."
echo ""

echo "8. Regions:"
RESPONSE=$(curl -s "$API_URL/regions")
REGION_COUNT=$(echo "$RESPONSE" | grep -o '"id"' | wc -l)
echo "Found $REGION_COUNT regions"
echo ""

