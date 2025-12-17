#!/bin/bash

# DATA STRUCTURE VERIFICATION TEST
# Verifies TypeScript interfaces and data models

echo "🧪 DATA STRUCTURE VERIFICATION TEST"
echo "===================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

check_interface() {
    local file=$1
    local interface_name=$2
    local description=$3
    
    echo -n "Checking: $description... "
    
    if grep -q "interface $interface_name" "$file" || grep -q "type $interface_name" "$file"; then
        echo -e "${GREEN}✓ FOUND${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ NOT FOUND${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

check_property() {
    local file=$1
    local property=$2
    local description=$3
    
    echo -n "  Property: $description... "
    
    if grep -q "$property" "$file"; then
        echo -e "${GREEN}✓${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${YELLOW}⚠${NC}"
        return 1
    fi
}

echo -e "${BLUE}Phase 1: Data Structures${NC}"
echo "---------------------------"

# Subscription Package Scheduling
echo ""
echo "Subscription Package Scheduling:"
check_interface "src/supabase/functions/server/subscription-package-scheduling.tsx" "PackageSlotRequest\|TimeSlot" "PackageSlotRequest/TimeSlot interface"
check_property "src/supabase/functions/server/subscription-package-scheduling.tsx" "timeWindow" "timeWindow property"
check_property "src/supabase/functions/server/subscription-package-scheduling.tsx" "available" "available property"

# Radar Service Discovery
echo ""
echo "Radar Service Discovery:"
check_interface "src/supabase/functions/server/radar-service-discovery.tsx" "ServiceProvider\|StaffDistanceConfig" "ServiceProvider interface"
check_property "src/supabase/functions/server/radar-service-discovery.tsx" "distance" "distance property"
check_property "src/supabase/functions/server/radar-service-discovery.tsx" "available" "available property"

# Universal GPS Tracking
echo ""
echo "Universal GPS Tracking:"
check_property "src/supabase/functions/server/universal-gps-tracking.tsx" "trackingSession\|currentLocation" "Tracking session structure"
check_property "src/supabase/functions/server/universal-gps-tracking.tsx" "route" "route property"

# Previous Providers
echo ""
echo "Previous Providers:"
check_interface "src/supabase/functions/server/previous-providers-service.tsx" "PreviousProvider" "PreviousProvider interface"
check_property "src/supabase/functions/server/previous-providers-service.tsx" "vendorId" "vendorId property"
check_property "src/supabase/functions/server/previous-providers-service.tsx" "totalBookings" "totalBookings property"

# Problem-First Search
echo ""
echo "Problem-First Search:"
check_interface "src/supabase/functions/server/problem-first-search.tsx" "ProblemSearchResult" "ProblemSearchResult interface"
check_property "src/supabase/functions/server/problem-first-search.tsx" "problem" "problem property"
check_property "src/supabase/functions/server/problem-first-search.tsx" "services" "services property"

# Instant Tele Booking
echo ""
echo "Instant Tele Booking:"
check_interface "src/supabase/functions/server/instant-tele-booking.tsx" "InstantTeleAssignment" "InstantTeleAssignment interface"
check_property "src/supabase/functions/server/instant-tele-booking.tsx" "assignedStaffId" "assignedStaffId property"
check_property "src/supabase/functions/server/instant-tele-booking.tsx" "videoCallLink" "videoCallLink property"

echo ""
echo -e "${BLUE}Phase 2: Data Structures${NC}"
echo "---------------------------"

# Center Booking Specialized Services
echo ""
echo "Center Booking Specialized Services:"
check_interface "src/supabase/functions/server/center-booking-specialized-services.tsx" "SpecializedService\|BookingWithServices" "SpecializedService interface"
check_property "src/supabase/functions/server/center-booking-specialized-services.tsx" "prescriptionId" "prescriptionId property"
check_property "src/supabase/functions/server/center-booking-specialized-services.tsx" "medicalRecordId" "medicalRecordId property"

# Role-Based Chat
echo ""
echo "Role-Based Chat:"
check_interface "src/supabase/functions/server/role-based-chat-integration.tsx" "RoleChatConfig" "RoleChatConfig interface"
check_property "src/supabase/functions/server/role-based-chat-integration.tsx" "chatEnabled" "chatEnabled property"
check_property "src/supabase/functions/server/role-based-chat-integration.tsx" "features" "features property"

# Complete Notification System
echo ""
echo "Complete Notification System:"
check_interface "src/supabase/functions/server/complete-notification-system.tsx" "NotificationEvent" "NotificationEvent interface"
check_property "src/supabase/functions/server/complete-notification-system.tsx" "channels" "channels property"
check_property "src/supabase/functions/server/complete-notification-system.tsx" "priority" "priority property"

echo ""
echo -e "${BLUE}Phase 3: Data Structures${NC}"
echo "---------------------------"

# Pet Profile Publishing
echo ""
echo "Pet Profile Publishing:"
check_interface "src/supabase/functions/server/pet-profile-publishing.tsx" "PetProfile" "PetProfile interface"
check_property "src/supabase/functions/server/pet-profile-publishing.tsx" "lineage" "lineage property"
check_property "src/supabase/functions/server/pet-profile-publishing.tsx" "vaccinationStatus" "vaccinationStatus property"
check_property "src/supabase/functions/server/pet-profile-publishing.tsx" "nature" "nature property"

echo ""
echo "=========================================="
echo -e "${BLUE}📊 DATA STRUCTURE TEST RESULTS${NC}"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All data structure tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some data structure tests failed${NC}"
    exit 1
fi

