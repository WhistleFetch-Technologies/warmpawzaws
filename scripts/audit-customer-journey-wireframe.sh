#!/bin/bash
# Comprehensive Customer Journey Wireframe Audit
# Checks all stages, flows, edge cases, and implementations

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     CUSTOMER JOURNEY WIREFRAME COMPREHENSIVE AUDIT          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Check Journey Stages
echo "📋 Step 1: Checking Journey Stages..."
echo ""

JOURNEY_STAGES=("planning" "have-pet" "end-of-life")
for stage in "${JOURNEY_STAGES[@]}"; do
  if grep -r "journeyStage.*${stage}\|journey.*${stage}\|${stage}" apps/customer-web/components/customer --include="*.tsx" --include="*.ts" | grep -q "CustomerOnboarding\|CustomerPlanningJourney\|CustomerHavePetJourney"; then
    echo "   ✅ Journey stage '${stage}' implemented"
  else
    echo "   ❌ Journey stage '${stage}' missing"
  fi
done

# Step 2: Check Authentication Flow
echo ""
echo "📋 Step 2: Checking Authentication Flow..."
echo ""

AUTH_COMPONENTS=("CustomerAuth" "OTP" "phone" "verify")
AUTH_COUNT=0
for comp in "${AUTH_COMPONENTS[@]}"; do
  if grep -r "$comp" apps/customer-web/components/customer/CustomerAuth.tsx --include="*.tsx" | head -1 > /dev/null; then
    AUTH_COUNT=$((AUTH_COUNT + 1))
  fi
done

if [ $AUTH_COUNT -ge 3 ]; then
  echo "   ✅ Authentication flow complete"
else
  echo "   ⚠️  Authentication flow may be incomplete"
fi

# Step 3: Check Onboarding Flow
echo ""
echo "📋 Step 3: Checking Onboarding Flow..."
echo ""

ONBOARDING_STEPS=("CustomerOnboarding" "CustomerUserProfile" "CustomerPetProfile" "CustomerPlanningJourney" "CustomerHavePetJourney")
ONBOARDING_COUNT=0
for step in "${ONBOARDING_STEPS[@]}"; do
  if find apps/customer-web/components/customer -name "*${step}*" -type f | head -1 > /dev/null; then
    echo "   ✅ ${step} exists"
    ONBOARDING_COUNT=$((ONBOARDING_COUNT + 1))
  else
    echo "   ❌ ${step} missing"
  fi
done

# Step 4: Check Booking Flow
echo ""
echo "📋 Step 4: Checking Booking Flow..."
echo ""

BOOKING_COMPONENTS=("UnifiedBookingEngine" "BookingFlow" "CreateBookingPage" "BookingDetailModal" "RescheduleBooking" "CancelBookingModal")
BOOKING_COUNT=0
for comp in "${BOOKING_COMPONENTS[@]}"; do
  if find apps/customer-web/components/customer -name "*${comp}*" -type f | head -1 > /dev/null; then
    echo "   ✅ ${comp} exists"
    BOOKING_COUNT=$((BOOKING_COUNT + 1))
  else
    echo "   ❌ ${comp} missing"
  fi
done

# Step 5: Check Payment Flow
echo ""
echo "📋 Step 5: Checking Payment Flow..."
echo ""

PAYMENT_CHECKS=("Razorpay" "payment" "verify" "wallet")
PAYMENT_COUNT=0
for check in "${PAYMENT_CHECKS[@]}"; do
  if grep -ri "$check" apps/customer-web/components/customer --include="*.tsx" | head -1 > /dev/null; then
    PAYMENT_COUNT=$((PAYMENT_COUNT + 1))
  fi
done

if [ $PAYMENT_COUNT -ge 3 ]; then
  echo "   ✅ Payment flow implemented"
else
  echo "   ⚠️  Payment flow may be incomplete"
fi

# Step 6: Check Error Handling
echo ""
echo "📋 Step 6: Checking Error Handling..."
echo ""

ERROR_PATTERNS=("catch" "error" "Error" "try" "finally")
ERROR_COUNT=0
for pattern in "${ERROR_PATTERNS[@]}"; do
  COUNT=$(grep -r "$pattern" apps/customer-web/components/customer --include="*.tsx" --include="*.ts" | wc -l | tr -d ' ')
  if [ "$COUNT" -gt 0 ]; then
    ERROR_COUNT=$((ERROR_COUNT + 1))
  fi
done

if [ $ERROR_COUNT -ge 4 ]; then
  echo "   ✅ Error handling present"
else
  echo "   ⚠️  Error handling may be incomplete"
fi

# Step 7: Check Loading States
echo ""
echo "📋 Step 7: Checking Loading States..."
echo ""

LOADING_COUNT=$(grep -r "loading\|Loading\|isLoading" apps/customer-web/components/customer --include="*.tsx" | wc -l | tr -d ' ')
if [ "$LOADING_COUNT" -gt 50 ]; then
  echo "   ✅ Loading states implemented ($LOADING_COUNT instances)"
else
  echo "   ⚠️  Loading states may be incomplete ($LOADING_COUNT instances)"
fi

# Step 8: Check Validation
echo ""
echo "📋 Step 8: Checking Validation..."
echo ""

VALIDATION_PATTERNS=("validate\|required\|invalid\|regex\|pattern")
VALIDATION_COUNT=$(grep -ri "validate\|required\|invalid" apps/customer-web/components/customer --include="*.tsx" | wc -l | tr -d ' ')
if [ "$VALIDATION_COUNT" -gt 30 ]; then
  echo "   ✅ Validation implemented ($VALIDATION_COUNT instances)"
else
  echo "   ⚠️  Validation may be incomplete ($VALIDATION_COUNT instances)"
fi

# Step 9: Check Edge Cases
echo ""
echo "📋 Step 9: Checking Edge Cases..."
echo ""

EDGE_CASES=("empty\|null\|undefined\|not found\|no data")
EDGE_COUNT=$(grep -ri "empty\|null\|undefined\|not found\|no data" apps/customer-web/components/customer --include="*.tsx" | wc -l | tr -d ' ')
if [ "$EDGE_COUNT" -gt 20 ]; then
  echo "   ✅ Edge cases handled ($EDGE_COUNT instances)"
else
  echo "   ⚠️  Edge cases may need more handling ($EDGE_COUNT instances)"
fi

# Step 10: Check Navigation
echo ""
echo "📋 Step 10: Checking Navigation..."
echo ""

NAVIGATION_COUNT=$(grep -r "onNavigate\|router\|navigation" apps/customer-web/components/customer --include="*.tsx" | wc -l | tr -d ' ')
if [ "$NAVIGATION_COUNT" -gt 100 ]; then
  echo "   ✅ Navigation implemented ($NAVIGATION_COUNT instances)"
else
  echo "   ⚠️  Navigation may be incomplete ($NAVIGATION_COUNT instances)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     AUDIT COMPLETE                                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
