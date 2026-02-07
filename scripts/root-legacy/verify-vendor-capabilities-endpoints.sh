#!/bin/bash
# ============================================================================
# Verify All 73 Vendor Capabilities Endpoints in Codebase
# ============================================================================
# Checks if each endpoint actually exists in the backend code
# ============================================================================

set -e

ENDPOINTS_DIR="backend/lambda/src/endpoints"
REPORT_FILE="VENDOR_CAPABILITIES_ENDPOINTS_VERIFICATION.md"

echo "================================================================="
echo "🔍 Verifying All 73 Vendor Capabilities Endpoints"
echo "================================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
FOUND=0
NOT_FOUND=0
MISMATCHED=0

# Function to check if endpoint exists
check_endpoint() {
  local METHOD=$1
  local PATTERN=$2
  local CAPABILITY=$3
  
  # Convert endpoint pattern to grep pattern
  # Escape special characters
  ESCAPED_PATTERN=$(echo "$PATTERN" | sed 's/\[/\\[/g' | sed 's/\]/\\]/g' | sed 's/\./\\\./g')
  
  # Search for the endpoint pattern
  # Look for app.get, app.post, app.put, app.delete with the pattern
  if grep -r "app\.${METHOD,,}.*['\"]${ESCAPED_PATTERN}" "$ENDPOINTS_DIR" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} ${CAPABILITY}: ${METHOD} ${PATTERN}"
    ((FOUND++))
    return 0
  else
    # Try alternative patterns
    # Remove :vendorId and try with :id
    ALT_PATTERN=$(echo "$PATTERN" | sed 's/:vendorId/:id/g')
    ESCAPED_ALT=$(echo "$ALT_PATTERN" | sed 's/\[/\\[/g' | sed 's/\]/\\]/g' | sed 's/\./\\\./g')
    
    if grep -r "app\.${METHOD,,}.*['\"]${ESCAPED_ALT}" "$ENDPOINTS_DIR" > /dev/null 2>&1; then
      echo -e "  ${YELLOW}⚠${NC} ${CAPABILITY}: ${METHOD} ${PATTERN} (found as ${ALT_PATTERN})"
      ((MISMATCHED++))
      return 1
    else
      echo -e "  ${RED}✗${NC} ${CAPABILITY}: ${METHOD} ${PATTERN}"
      ((NOT_FOUND++))
      return 1
    fi
  fi
}

# Start report
cat > "$REPORT_FILE" << 'EOF'
# Vendor Capabilities Endpoints Verification Report

## Date: 2026-01-02

This report verifies all 73 endpoints mapped from 45 vendor capabilities against the actual codebase.

---

EOF

echo -e "${BLUE}=== Core Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 1. dashboard
check_endpoint "GET" "/vendor/dashboard/:vendorId" "dashboard" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/stats/:vendorId" "dashboard (stats)" | tee -a "$REPORT_FILE"

# 2. bookings
check_endpoint "GET" "/vendor/bookings/:vendorId" "bookings" | tee -a "$REPORT_FILE"

# 3. profile
check_endpoint "GET" "/vendor/:vendorId/profile" "profile" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/complete" "profile (complete)" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Services Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 4. services
check_endpoint "GET" "/vendor/:vendorId/services" "services" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/service-catalog/complete" "services (complete catalog)" | tee -a "$REPORT_FILE"

# 5. packages - Check packages.ts
if grep -r "app\.get.*packages" "$ENDPOINTS_DIR/packages.ts" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} packages: GET /vendor/:vendorId/packages (via packages.ts)"
  ((FOUND++))
else
  echo -e "  ${RED}✗${NC} packages: GET /vendor/:vendorId/packages"
  ((NOT_FOUND++))
fi

# 6. pricing - part of services
check_endpoint "GET" "/vendor/:vendorId/services" "pricing (via services)" | tee -a "$REPORT_FILE"

# 7. test_catalog
check_endpoint "GET" "/vendor/:vendorId/diagnostics/tests" "test_catalog" | tee -a "$REPORT_FILE"

# 8. menu
check_endpoint "GET" "/vendor/:vendorId/cafe/menu" "menu" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:id/cafe/menu" "menu (alt)" | tee -a "$REPORT_FILE"

# 9. products
check_endpoint "GET" "/vendor/:vendorId/products" "products" | tee -a "$REPORT_FILE"

# 10. subscriptions
if grep -r "app\.get.*subscriptions.*vendor" "$ENDPOINTS_DIR/subscriptions.ts" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} subscriptions: GET /subscriptions/plans/vendor/:vendorId"
  ((FOUND++))
else
  echo -e "  ${RED}✗${NC} subscriptions: GET /vendor/:vendorId/subscriptions"
  ((NOT_FOUND++))
fi

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Booking Style Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 11-17. Booking styles use same booking endpoint with filters
check_endpoint "GET" "/vendor/bookings/:vendorId" "centre_booking (via bookings)" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/bookings/:vendorId" "home_services (via bookings)" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/bookings/:vendorId" "tele_consultation (via bookings)" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/bookings/:vendorId" "walking (via bookings)" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/cafe/tables" "reservations (tables)" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/resort/rooms" "checkin_checkout (rooms)" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/active-trackings" "route_tracking" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Operations Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 18. staff
check_endpoint "GET" "/vendor/:vendorId/staff" "staff" | tee -a "$REPORT_FILE"

# 19. schedule
check_endpoint "GET" "/vendor/:vendorId/schedule" "schedule" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/slots/:date" "schedule (slots)" | tee -a "$REPORT_FILE"

# 20. service_radius
check_endpoint "GET" "/vendor/:id/radar-distance" "service_radius" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/radar-distance" "service_radius (alt)" | tee -a "$REPORT_FILE"

# 21. gps_tracking
check_endpoint "GET" "/vendor/tracking/:bookingId/status" "gps_tracking" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/gps-tracking/booking/:bookingId" "gps_tracking (customer)" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Finance Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 22. earnings
check_endpoint "GET" "/vendor/analytics/revenue" "earnings" | tee -a "$REPORT_FILE"

# 23. settlements
check_endpoint "GET" "/vendor/:vendorId/settlements" "settlements" | tee -a "$REPORT_FILE"

# 24. bank_account
check_endpoint "GET" "/vendor/:vendorId/bank-details" "bank_account" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Medical Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 25. prescriptions
if grep -r "app\.get.*prescriptions" "$ENDPOINTS_DIR/prescriptions.ts" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} prescriptions: GET /prescriptions (exists in prescriptions.ts)"
  ((FOUND++))
else
  echo -e "  ${RED}✗${NC} prescriptions: GET /prescriptions?vendorId=:vendorId"
  ((NOT_FOUND++))
fi

# 26. medical_records
if grep -r "app\.get.*medical-records" "$ENDPOINTS_DIR/medical-records.ts" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} medical_records: GET /medical-records (exists in medical-records.ts)"
  ((FOUND++))
else
  echo -e "  ${RED}✗${NC} medical_records: GET /medical-records?vendorId=:vendorId"
  ((NOT_FOUND++))
fi

# 27. vaccination - Check if exists
if grep -r "vaccination\|vaccinations" "$ENDPOINTS_DIR" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} vaccination: Endpoint exists (check medical-records or specialized-services)"
  ((FOUND++))
else
  echo -e "  ${YELLOW}⚠${NC} vaccination: May be part of medical-records"
  ((MISMATCHED++))
fi

# 28. diagnostics
check_endpoint "GET" "/vendor/:vendorId/diagnostics/tests" "diagnostics" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Pharmacy Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 29. pharmacy
check_endpoint "GET" "/vendor/:vendorId/pharmacy/medicines" "pharmacy" | tee -a "$REPORT_FILE"

# 30. inventory
check_endpoint "GET" "/vendor/:vendorId/products" "inventory (via products)" | tee -a "$REPORT_FILE"

# 31. orders
check_endpoint "GET" "/vendor/:vendorId/orders" "orders" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/orders/stats" "orders (stats)" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Ambulance Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 32-33. ambulance & vehicles
check_endpoint "GET" "/vendor/:vendorId/ambulance/vehicles" "ambulance" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/ambulance/vehicles" "vehicles" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Cafe Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 34. cafe_tables
check_endpoint "GET" "/vendor/:vendorId/cafe/tables" "cafe_tables" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:id/tables" "cafe_tables (alt)" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:id/tables/availability" "cafe_tables (availability)" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Resort Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 35-36. rooms & boarding
check_endpoint "GET" "/vendor/:vendorId/resort/rooms" "rooms" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:id/rooms" "rooms (alt)" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/resort/rooms" "boarding" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Insurance Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 37-39. insurance
check_endpoint "GET" "/insurance/plans" "insurance_plans" | tee -a "$REPORT_FILE"
if grep -r "app\.get.*insurance.*policies" "$ENDPOINTS_DIR/insurance.ts" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} policies: GET /insurance/policies (exists in insurance.ts)"
  ((FOUND++))
else
  echo -e "  ${RED}✗${NC} policies: GET /insurance/policies?vendorId=:vendorId"
  ((NOT_FOUND++))
fi
if grep -r "app\.(get|post).*insurance.*claims" "$ENDPOINTS_DIR/insurance.ts" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} claims: GET/POST /insurance/claims (exists in insurance.ts)"
  ((FOUND++))
else
  echo -e "  ${RED}✗${NC} claims: GET /insurance/claims?vendorId=:vendorId"
  ((NOT_FOUND++))
fi

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Adoption Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 40-42. adoption
check_endpoint "GET" "/vendor/:vendorId/breeder/puppies" "adoption" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/breeder/puppies" "pet_profiles" | tee -a "$REPORT_FILE"
# lineage - check pets.ts
if grep -r "lineage\|pedigree" "$ENDPOINTS_DIR" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} lineage: Endpoint may exist (check pets.ts or specialized-services.ts)"
  ((FOUND++))
else
  echo -e "  ${YELLOW}⚠${NC} lineage: GET /pets/lineage?vendorId=:vendorId (may need to be created)"
  ((MISMATCHED++))
fi

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Training Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 43-44. training
if grep -r "app\.get.*training.*programs" "$ENDPOINTS_DIR/training-progress.ts" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} training_programs: Endpoint exists in training-progress.ts"
  ((FOUND++))
else
  echo -e "  ${YELLOW}⚠${NC} training_programs: GET /training/programs?vendorId=:vendorId (check packages)"
  ((MISMATCHED++))
fi
check_endpoint "GET" "/training/progress/:packageId" "progress_tracking" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Nutrition Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 45-46. nutrition
check_endpoint "GET" "/vendor/:vendorId/nutritionist/meal-plans" "meal_plans" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/nutrition/meal-plans" "meal_plans (alt)" | tee -a "$REPORT_FILE"
if grep -r "delivery.*order\|nutrition.*delivery" "$ENDPOINTS_DIR/specialized-services.ts" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} food_delivery: POST /nutrition/delivery-orders (exists in specialized-services.ts)"
  ((FOUND++))
else
  echo -e "  ${RED}✗${NC} food_delivery: GET /vendor/:vendorId/nutrition/delivery-orders"
  ((NOT_FOUND++))
fi

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Holiday Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 47-48. holidays
check_endpoint "GET" "/vendor/:id/holiday-packages" "holiday_packages" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/holidays/packages" "holiday_packages (public)" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/holidays/packages" "tour_schedule (via packages)" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== E-commerce Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 49. seller_hub
check_endpoint "GET" "/vendor/:vendorId/products" "seller_hub (products)" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/orders" "seller_hub (orders)" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Communication Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 50-52. communication
if grep -r "app\.get.*chat.*message" "$ENDPOINTS_DIR/chat.ts" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} chat: GET /chat/booking/:bookingId/conversation (exists in chat.ts)"
  ((FOUND++))
else
  echo -e "  ${YELLOW}⚠${NC} chat: GET /chat/messages?vendorId=:vendorId (check chat.ts)"
  ((MISMATCHED++))
fi
check_endpoint "GET" "/video-call/:bookingId" "video_call" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/notifications" "notifications" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Operations Capabilities ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# 53-56. operations
check_endpoint "GET" "/reviews" "reviews" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/analytics/dashboard" "analytics" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/analytics/sales" "analytics (sales)" | tee -a "$REPORT_FILE"
if grep -r "app\.(get|post).*reports" "$ENDPOINTS_DIR/reports.ts" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} reports: GET/POST /admin/reports (exists in reports.ts)"
  ((FOUND++))
else
  echo -e "  ${RED}✗${NC} reports: GET /reports?vendorId=:vendorId"
  ((NOT_FOUND++))
fi
check_endpoint "GET" "/vendor/:vendorId/security" "settings" | tee -a "$REPORT_FILE"

echo "" | tee -a "$REPORT_FILE"
echo -e "${BLUE}=== Additional Endpoints ===${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Additional capability-specific endpoints
check_endpoint "GET" "/vendor/distance-pricing/:vendorId" "distance_pricing" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/staff/:staffId/availability" "staff_availability" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/gps-tracking/booking/:bookingId" "gps_tracking_status" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/vendor/:vendorId/service-catalog/complete" "service_catalog_complete" | tee -a "$REPORT_FILE"
check_endpoint "GET" "/admin/capabilities" "capabilities_list" | tee -a "$REPORT_FILE"

# Summary
echo "" | tee -a "$REPORT_FILE"
echo "=================================================================" | tee -a "$REPORT_FILE"
echo "📊 Verification Summary" | tee -a "$REPORT_FILE"
echo "=================================================================" | tee -a "$REPORT_FILE"
echo -e "${GREEN}Found: ${FOUND}${NC}" | tee -a "$REPORT_FILE"
echo -e "${YELLOW}Mismatched (different pattern): ${MISMATCHED}${NC}" | tee -a "$REPORT_FILE"
echo -e "${RED}Not Found: ${NOT_FOUND}${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"
TOTAL=$((FOUND + MISMATCHED + NOT_FOUND))
echo "Total Checked: ${TOTAL}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

if [ $NOT_FOUND -eq 0 ]; then
  echo -e "${GREEN}✅ All endpoints found or have alternatives!${NC}" | tee -a "$REPORT_FILE"
else
  echo -e "${YELLOW}⚠️  Some endpoints need to be created or mapped${NC}" | tee -a "$REPORT_FILE"
fi

echo ""
echo "Report saved to: ${REPORT_FILE}"
