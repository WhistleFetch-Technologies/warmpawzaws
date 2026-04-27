#!/bin/bash
# ============================================================================
# SEED: Policies, Tax Rules (HSN), Banners, Spotlight & Promotions
# ============================================================================
# Run after backend is deployed. Uses curl so failures can be identified/fixed.
# Verify in Admin UI: Finance > Policies/Tax, Marketing > Banners/Spotlight/Promotions
# Customer: Home banners, service dashboards spotlight, booking flow policies & tax
# ============================================================================

set -e

API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

if [ -n "$AUTH_TOKEN" ]; then
  AUTH_HEADER="Authorization: Bearer $AUTH_TOKEN"
else
  AUTH_HEADER="x-uat-mode: true"
fi

echo "=============================================="
echo "Policies, Tax, Banners, Spotlight Seed"
echo "=============================================="
echo "API: $API_BASE_URL"
echo ""

# --- 1) REFUND / CANCELLATION RULES (booking_cancellation_rules) ---
echo "1) Refund rules (booking_cancellation_rules)..."
RREF=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/admin/refund-rules" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "fullRefundBeforeHours": 48,
    "partialRefundBeforeHours": 24,
    "partialRefundPercentage": 50,
    "cancellationCutoffHours": 6,
    "isActive": true
  }')
HTTP=$(echo "$RREF" | tail -n1)
BODY=$(echo "$RREF" | sed '$d')
if [ "$HTTP" != "200" ]; then echo "  FAIL $HTTP: $BODY"; else echo "  OK"; fi

# --- 2) CANCELLATION POLICIES (cancellation_policies) ---
echo "2) Cancellation policies..."
CPOL=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/admin/finance/cancellation-policies" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "name": "Standard Cancellation",
    "description": "Full refund 48h before, 50% 24h before, no refund within 6h",
    "gracePeriodHours": 2,
    "cancellationWindows": [
      { "hoursBefore": 48, "refundPercentage": 100, "penaltyPercentage": 0 },
      { "hoursBefore": 24, "refundPercentage": 50, "penaltyPercentage": 0 },
      { "hoursBefore": 6, "refundPercentage": 0, "penaltyPercentage": 100 }
    ],
    "isActive": true
  }')
HTTP=$(echo "$CPOL" | tail -n1)
BODY=$(echo "$CPOL" | sed '$d')
if [ "$HTTP" != "200" ]; then echo "  FAIL $HTTP: $BODY"; else echo "  OK"; fi

# --- 3) SCHEDULING POLICIES ---
echo "3) Scheduling policies (buffer + slot)..."
for POL in '{"policy_name":"Standard Buffer","policy_type":"buffer_time","policy_config":{"minBufferTime":30,"maxConcurrentBookingsPerVendor":1},"is_active":true}' \
           '{"policy_name":"Standard Slot","policy_type":"slot_duration","policy_config":{"slotDuration":30,"breakBetweenSlots":15},"is_active":true}'; do
  SPOL=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/admin/scheduling-policies" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "$POL")
  HTTP=$(echo "$SPOL" | tail -n1)
  if [ "$HTTP" != "200" ]; then echo "  FAIL $HTTP"; else echo "  OK"; fi
done

# --- 4) FEE CONFIGURATION ---
echo "4) Fee configuration..."
FEE=$(curl -s -w "\n%{http_code}" -X PUT "$API_BASE_URL/admin/finance/fee-configuration" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "config": {
      "platformFeePercentage": 2,
      "maxPlatformFee": 200,
      "convenienceFeeBooking": 10,
      "convenienceFeeOrder": 0,
      "convenienceFeeTele": 5,
      "deliveryFeeBase": 0,
      "freeDeliveryThreshold": 500,
      "packagingFeeAmount": 15
    }
  }')
HTTP=$(echo "$FEE" | tail -n1)
if [ "$HTTP" != "200" ]; then echo "  FAIL $HTTP"; else echo "  OK"; fi

# --- 5) TAX RULES (gst_rules) ---
echo "5) Tax rules (GST)..."
for RULE in \
  '{"rule_name":"Standard 18%","enabled":true,"priority":100,"gst_type":"percentage","gst_rate":18,"cgst_percentage":9,"sgst_percentage":9,"igst_percentage":18,"description":"Default 18% for services"}' \
  '{"rule_name":"At-Home 18%","enabled":true,"priority":150,"service_style":"at_home","gst_type":"percentage","gst_rate":18,"cgst_percentage":9,"sgst_percentage":9,"igst_percentage":18}' \
  '{"rule_name":"Tele 18%","enabled":true,"priority":150,"service_style":"tele","gst_type":"percentage","gst_rate":18,"cgst_percentage":9,"sgst_percentage":9,"igst_percentage":18}' \
  '{"rule_name":"Pet Medicines 12%","enabled":true,"priority":200,"category":"pet_medicines","gst_type":"percentage","gst_rate":12,"cgst_percentage":6,"sgst_percentage":6,"igst_percentage":12}' \
  '{"rule_name":"Pet Food 18%","enabled":true,"priority":200,"category":"pet_food","gst_type":"percentage","gst_rate":18,"cgst_percentage":9,"sgst_percentage":9,"igst_percentage":18}'; do
  TAX=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/admin/tax-rules" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "$RULE")
  HTTP=$(echo "$TAX" | tail -n1)
  if [ "$HTTP" != "200" ]; then echo "  FAIL $HTTP"; else echo "  OK"; fi
done

# --- 6) HSN CODES (for products/services) ---
echo "6) HSN codes..."
# Veterinary services (SAC 998351) - Nil per some notifications; 18% in many systems - use 0 for exemption or 18
for HSN in \
  '{"code":"998351","description":"Veterinary services for pet animals","gstRate":0,"isActive":true}' \
  '{"code":"998612","description":"Animal husbandry, grooming, boarding, training","gstRate":0,"isActive":true}' \
  '{"code":"2309","description":"Dog or cat food","gstRate":18,"isActive":true}' \
  '{"code":"0106","description":"Live animals (pets)","gstRate":0,"isActive":true}' \
  '{"code":"3004","description":"Veterinary medicines","gstRate":12,"isActive":true}' \
  '{"code":"4201","description":"Pet accessories (leather)","gstRate":12,"isActive":true}' \
  '{"code":"6307","description":"Pet accessories (textile)","gstRate":12,"isActive":true}' \
  '{"code":"3926","description":"Pet accessories (plastic)","gstRate":12,"isActive":true}' \
  '{"code":"9609","description":"Pet grooming tools and general goods","gstRate":18,"isActive":true}'; do
  H=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/admin/finance/gst/hsn-codes" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "$HSN")
  HTTP=$(echo "$H" | tail -n1)
  if [ "$HTTP" != "200" ]; then echo "  skip/dup $HTTP"; else echo "  OK"; fi
done

# --- 7) BANNERS (customer home + dashboards) ---
echo "7) Banners (type=main for customer home)..."
for BAN in \
  '{"type":"main","title":"Free Health Checkup","subtitle":"Book Vet Appointment Today","ctaText":"Book Now","ctaLink":"/vet","display_order":1,"metadata":{"gradient_from":"#4CAF50","gradient_to":"#2E7D32","icon":"🩺"},"isActive":true}'; do
  B=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/admin/banners" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "$BAN")
  HTTP=$(echo "$B" | tail -n1)
  if [ "$HTTP" != "200" ]; then echo "  FAIL $HTTP"; else echo "  OK"; fi
done

# --- 8) SPOTLIGHT OFFERS (per role for dashboards) ---
echo "8) Spotlight offers..."
for SPOT in \
  '{"roleId":"veterinarian","serviceCategory":"vet","title":"Free Health Check","subtitle":"First visit","discountType":"percentage","discountValue":100,"badgeText":"First Visit","icon":"🩺","ctaText":"Book Now","ctaLink":"/vet","is_active":true,"display_order":1}' \
  '{"roleId":"groomer","serviceCategory":"grooming","title":"50% Off Grooming","subtitle":"First session","discountType":"percentage","discountValue":50,"badgeText":"Limited Time","icon":"✂️","ctaText":"Claim","ctaLink":"/grooming","is_active":true,"display_order":1}' \
  '{"roleId":"trainer","serviceCategory":"training","title":"20% Off Training","subtitle":"First package","discountType":"percentage","discountValue":20,"badgeText":"New User","icon":"🎓","ctaText":"Book","ctaLink":"/training","is_active":true,"display_order":1}' \
  '{"roleId":"boarder","serviceCategory":"boarding","title":"10% Off Boarding","subtitle":"Week stay","discountType":"percentage","discountValue":10,"badgeText":"Seasonal","icon":"🏠","ctaText":"Book","ctaLink":"/boarding","is_active":true,"display_order":1}'; do
  S=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/marketing/spotlights" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "$SPOT")
  HTTP=$(echo "$S" | tail -n1)
  if [ "$HTTP" != "200" ]; then echo "  FAIL $HTTP"; else echo "  OK"; fi
done

# --- 9) PROMOTIONS (with code, spotlight, published for list/validate) ---
echo "9) Promotions (with code, spotlight, published)..."
for PROMO in \
  '{"name":"First Grooming 50%","description":"Half off first grooming","promotionType":"discount","discountType":"percentage","discountValue":50,"minOrderAmount":0,"startDate":"2025-01-01","endDate":"2026-12-31","isActive":true,"applicable_services":["grooming"],"priority":10,"is_spotlight":true,"published":true,"code":"GROOM50"}' \
  '{"name":"Vet Check 100","description":"Free first vet check","promotionType":"free_service","discountType":"fixed","discountValue":0,"minOrderAmount":0,"startDate":"2025-01-01","endDate":"2026-12-31","isActive":true,"applicable_services":["vet"],"priority":10,"is_spotlight":true,"published":true,"code":"VET100"}' \
  '{"name":"Shop 20% Off","description":"20% off first order","promotionType":"discount","discountType":"percentage","discountValue":20,"minOrderAmount":500,"startDate":"2025-01-01","endDate":"2026-12-31","isActive":true,"applicable_services":["shop","ecom"],"priority":5,"is_spotlight":false,"published":true,"code":"SAVE20"}'; do
  P=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/marketing/promotions" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d "$PROMO")
  HTTP=$(echo "$P" | tail -n1)
  if [ "$HTTP" != "200" ]; then echo "  FAIL $HTTP"; else echo "  OK"; fi
done

echo ""
echo "=============================================="
echo "Seed complete. Verify:"
echo "  - Customer: GET /customer/banners?position=home_top"
echo "  - Promotions: GET /promotions/list?service=grooming&published=true&spotlight=true"
echo "  - Spotlights: GET /marketing/spotlights?active=true"
echo "  - Policies: GET /config/policies?service_type=booking"
echo "  - Tax: used in booking/checkout and product pricing"
echo "=============================================="
