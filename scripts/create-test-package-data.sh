#!/bin/bash
# Create test data for package booking, GPS tracking, and training progress
# Usage: ./scripts/create-test-package-data.sh [phone] [vendorId]

set -euo pipefail

API_BASE="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
TEST_PHONE="${1:-9876543210}"
VENDOR_ID="${2:-4dd488a2-54a9-4246-80b4-8b3e28636998}"

echo "🧪 Creating Test Data for Package Booking, GPS Tracking, and Training"
echo "======================================================================"
echo "Phone: $TEST_PHONE"
echo "Vendor ID: $VENDOR_ID"
echo ""

# Get customer ID from phone
echo "1. Getting customer ID..."
CUSTOMER_RESPONSE=$(curl -s "${API_BASE}/customer/profile?phone=${TEST_PHONE}")
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$CUSTOMER_ID" ]; then
    echo "❌ Customer not found. Please create customer first."
    exit 1
fi

echo "✅ Customer ID: $CUSTOMER_ID"
echo ""

# Create a test package purchase (via admin endpoint or direct SQL)
echo "2. Creating test package purchase..."
# Note: This would typically go through admin endpoints or direct database insert
# For now, we'll document what needs to be created

cat << EOF
📋 Test Data to Create:

1. Package Purchase (package_purchases table):
   - customer_id: $CUSTOMER_ID
   - vendor_id: $VENDOR_ID
   - package_name: "5 Session Vet Package"
   - package_type: "appointment"
   - total_sessions: 5
   - remaining_sessions: 3
   - status: "active"
   - expires_at: (30 days from now)

2. Active Walk Session (walker_live_sessions table):
   - booking_id: (existing booking ID)
   - walker_id: $VENDOR_ID
   - customer_id: $CUSTOMER_ID
   - is_active: true
   - current_lat: 19.0760
   - current_lng: 72.8777

3. Training Progress (pet_skill_progress table):
   - pet_id: (existing pet ID)
   - skill_id: (existing skill ID)
   - progress_level: 75
   - status: "in_progress"

EOF

echo "💡 To create this data, you can:"
echo "   1. Use admin endpoints to create packages"
echo "   2. Insert directly into database"
echo "   3. Use the vendor dashboard to create packages"
echo ""
