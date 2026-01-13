#!/bin/bash
API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"

echo "🔍 TESTING FIXED ADMIN ENDPOINTS"
echo "=================================="
echo ""

echo "1. Customers List:"
curl -s "$API_URL/admin/customers" | jq -r '.success, .count, (.customers[0] | keys)'
echo ""

echo "2. Bookings List:"
curl -s "$API_URL/admin/bookings" | jq -r '.success, .count'
echo ""

echo "3. GST Configs:"
curl -s "$API_URL/admin/gst-configs" | jq -r '.success, .count'
echo ""

echo "4. Policies:"
curl -s "$API_URL/admin/policies" | jq -r '.success, .count'
echo ""

echo "5. Staff List:"
curl -s "$API_URL/admin/staff" | jq -r '.success, .count'
echo ""

echo "6. Pets List:"
curl -s "$API_URL/admin/pets" | jq -r '.success, .count'
echo ""

