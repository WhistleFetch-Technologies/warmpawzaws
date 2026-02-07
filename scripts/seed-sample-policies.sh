#!/bin/bash

# ============================================================================
# SAMPLE POLICY & TAX RULES SEEDING SCRIPT
# ============================================================================
# This script creates sample policies and tax rules via API (not DB seeding)
# Run this after deploying the backend to set up initial rules
# ============================================================================

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

echo "=============================================="
echo "🚀 Sample Policy & Tax Rules Seeding Script"
echo "=============================================="
echo ""
echo "API URL: $API_BASE_URL"
echo ""

# Check if token is provided
if [ -z "$AUTH_TOKEN" ]; then
    echo "⚠️  No AUTH_TOKEN provided. Using UAT mode..."
    AUTH_HEADER="x-uat-mode: true"
else
    AUTH_HEADER="Authorization: Bearer $AUTH_TOKEN"
fi

echo "=============================================="
echo "📋 Creating Tax Rules..."
echo "=============================================="

# 1. Standard GST Rule (Default 18%)
echo "Creating Standard GST Rule (18%)..."
curl -s -X POST "$API_BASE_URL/admin/tax-rules" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "rule_name": "Standard GST Rate - All Services",
    "enabled": true,
    "priority": 100,
    "gst_type": "percentage",
    "gst_rate": 18,
    "cgst_percentage": 9,
    "sgst_percentage": 9,
    "igst_percentage": 18,
    "description": "Default 18% GST rate for all pet services"
  }'
echo ""

# 2. At-Home Services Tax Rule
echo "Creating At-Home Services Tax Rule..."
curl -s -X POST "$API_BASE_URL/admin/tax-rules" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "rule_name": "At-Home Services - 18% GST",
    "enabled": true,
    "priority": 150,
    "service_style": "at_home",
    "gst_type": "percentage",
    "gst_rate": 18,
    "cgst_percentage": 9,
    "sgst_percentage": 9,
    "igst_percentage": 18,
    "description": "GST rate for at-home pet services"
  }' 
echo ""

# 3. Tele-consultation Tax Rule (Lower rate)
echo "Creating Tele-consultation Tax Rule..."
curl -s -X POST "$API_BASE_URL/admin/tax-rules" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "rule_name": "Tele-consultation Services - 18% GST",
    "enabled": true,
    "priority": 150,
    "service_style": "tele",
    "gst_type": "percentage",
    "gst_rate": 18,
    "cgst_percentage": 9,
    "sgst_percentage": 9,
    "igst_percentage": 18,
    "description": "GST rate for tele-consultation services"
  }' 
echo ""

# 4. Pet Medicines Tax Rule (12%)
echo "Creating Pet Medicines Tax Rule (12%)..."
curl -s -X POST "$API_BASE_URL/admin/tax-rules" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "rule_name": "Pet Medicines - 12% GST",
    "enabled": true,
    "priority": 300,
    "category": "pet_medicines",
    "gst_type": "percentage",
    "gst_rate": 12,
    "cgst_percentage": 6,
    "sgst_percentage": 6,
    "igst_percentage": 12,
    "description": "Lower GST rate for pet medicines and pharmaceuticals"
  }' 
echo ""

# 5. Pet Food Tax Rule (5%)
echo "Creating Pet Food Tax Rule (5%)..."
curl -s -X POST "$API_BASE_URL/admin/tax-rules" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "rule_name": "Pet Food - 5% GST",
    "enabled": true,
    "priority": 300,
    "category": "pet_food",
    "gst_type": "percentage",
    "gst_rate": 5,
    "cgst_percentage": 2.5,
    "sgst_percentage": 2.5,
    "igst_percentage": 5,
    "description": "Lower GST rate for pet food products"
  }' 
echo ""

# 6. Maharashtra Intrastate Rule
echo "Creating Maharashtra Intrastate Tax Rule..."
curl -s -X POST "$API_BASE_URL/admin/tax-rules" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "rule_name": "Maharashtra Intrastate - CGST+SGST",
    "enabled": true,
    "priority": 200,
    "customer_state": "Maharashtra",
    "vendor_state": "Maharashtra",
    "gst_type": "percentage",
    "gst_rate": 18,
    "cgst_percentage": 9,
    "sgst_percentage": 9,
    "igst_percentage": 0,
    "description": "Intrastate transaction within Maharashtra - CGST+SGST applies"
  }' 
echo ""

echo "=============================================="
echo "💰 Creating Fee Configuration..."
echo "=============================================="

# Platform Fees Configuration (PUT fee-configuration)
echo "Creating Platform Fee Configuration..."
curl -s -X PUT "$API_BASE_URL/admin/finance/fee-configuration" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "config": {
      "platformFeePercentage": 2,
      "maxPlatformFee": 200,
      "convenienceFeeBooking": 10,
      "convenienceFeeOrder": 0,
      "convenienceFeeTele": 5,
      "packagingFeeAmount": 15
    }
  }' 
echo ""

echo "=============================================="
echo "❌ Creating Cancellation Policies..."
echo "=============================================="

# Standard Cancellation Policy
echo "Creating Standard Cancellation Policy..."
curl -s -X POST "$API_BASE_URL/admin/finance/cancellation-policies" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "name": "Standard Cancellation Policy",
    "policyType": "standard",
    "vendorTypes": [],
    "serviceTypes": [],
    "gracePeriodHours": 2,
    "cancellationWindows": [
      { "hoursBefore": 48, "refundPercentage": 100, "cancellationFee": 0, "penaltyPercentage": 0 },
      { "hoursBefore": 24, "refundPercentage": 75, "cancellationFee": 0, "penaltyPercentage": 0 },
      { "hoursBefore": 12, "refundPercentage": 50, "cancellationFee": 50, "penaltyPercentage": 0 },
      { "hoursBefore": 6, "refundPercentage": 25, "cancellationFee": 75, "penaltyPercentage": 0 },
      { "hoursBefore": 0, "refundPercentage": 0, "cancellationFee": 100, "penaltyPercentage": 10 }
    ],
    "vendorCancellationPenalty": {
      "enabled": true,
      "penaltyPercentage": 10,
      "compensationPercentage": 50
    },
    "noShowPolicy": {
      "enabled": true,
      "refundPercentage": 0,
      "penaltyAmount": 0
    },
    "isActive": true,
    "priority": 1
  }' 
echo ""

echo "=============================================="
echo "🔄 Creating Refund Rules..."
echo "=============================================="

# Standard Refund Rule (camelCase for API)
echo "Creating Standard Refund Rule..."
curl -s -X POST "$API_BASE_URL/admin/refund-rules" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "fullRefundBeforeHours": 48,
    "partialRefundBeforeHours": 24,
    "partialRefundPercentage": 50,
    "cancellationCutoffHours": 6,
    "isActive": true
  }' 
echo ""

echo "=============================================="
echo "📅 Creating Scheduling Policies..."
echo "=============================================="

# Buffer Time Policy
echo "Creating Buffer Time Policy..."
curl -s -X POST "$API_BASE_URL/admin/scheduling-policies" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "policy_name": "Standard Buffer Time",
    "policy_type": "buffer_time",
    "policy_config": {
      "minBufferTime": 30,
      "maxConcurrentBookingsPerVendor": 1
    },
    "is_active": true
  }' 
echo ""

# Slot Duration Policy
echo "Creating Slot Duration Policy..."
curl -s -X POST "$API_BASE_URL/admin/scheduling-policies" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "policy_name": "Standard Slot Duration",
    "policy_type": "slot_duration",
    "policy_config": {
      "slotDuration": 30,
      "breakBetweenSlots": 15
    },
    "is_active": true
  }' 
echo ""

echo "=============================================="
echo "🎁 Creating Loyalty Rules..."
echo "=============================================="

# Basic Loyalty Rule
echo "Creating Basic Loyalty Rule..."
curl -s -X POST "$API_BASE_URL/admin/loyalty/rules" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "name": "Standard Loyalty Program",
    "pointsPerRupee": 1,
    "redemptionRate": 1,
    "minRedemptionPoints": 100,
    "expiryDays": 365,
    "isActive": true
  }' 
echo ""

# Booking Action Rule
echo "Creating Booking Action Loyalty Rule..."
curl -s -X POST "$API_BASE_URL/admin/loyalty-action-rules" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "action": "book_service",
    "points_type": "per_amount",
    "points_value": 1,
    "conditions": {},
    "frequency_limit": null,
    "frequency_period": null,
    "multiplier": 1,
    "is_active": true
  }' 
echo ""

# First Purchase Action Rule
echo "Creating First Purchase Bonus Rule..."
curl -s -X POST "$API_BASE_URL/admin/loyalty-action-rules" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "action": "buy_first_product",
    "points_type": "fixed",
    "points_value": 200,
    "conditions": {},
    "frequency_limit": 1,
    "frequency_period": "lifetime",
    "multiplier": 1,
    "is_active": true
  }' 
echo ""

# Signup Bonus Rule
echo "Creating Signup Bonus Rule..."
curl -s -X POST "$API_BASE_URL/admin/loyalty-action-rules" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "action": "signup",
    "points_type": "fixed",
    "points_value": 100,
    "conditions": {},
    "frequency_limit": 1,
    "frequency_period": "lifetime",
    "multiplier": 1,
    "is_active": true
  }' 
echo ""

echo "=============================================="
echo "✅ Sample Policies Created Successfully!"
echo "=============================================="
echo ""
echo "Created:"
echo "  - 6 Tax Rules (Standard, At-Home, Tele, Medicines, Food, Maharashtra)"
echo "  - 1 Fee Configuration (Platform + Service Style fees)"
echo "  - 1 Cancellation Policy (Standard with windows)"
echo "  - 1 Refund Rule (Standard)"
echo "  - 2 Scheduling Policies (Buffer Time, Slot Duration)"
echo "  - 4 Loyalty Rules (Basic, Booking, First Purchase, Signup)"
echo ""
echo "You can verify these in the Admin Dashboard:"
echo "  - Tax Rules: Platform Settings > Tax Management"
echo "  - Fees: Finance > Fee Configuration"
echo "  - Policies: Finance > Cancellation Policies"
echo "  - Loyalty: Loyalty & Rewards"
echo ""
