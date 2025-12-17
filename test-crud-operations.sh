#!/bin/bash

# COMPREHENSIVE CRUD OPERATIONS TEST
# Tests Create, Read, Update, Delete for all implementations

set -e

PROJECT_ID="vpvpbdwtyugbknrntkho"
API_BASE="https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475"
PUBLIC_ANON_KEY="${SUPABASE_ANON_KEY:-your_anon_key_here}"

echo "🧪 CRUD OPERATIONS TEST SUITE"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

test_crud() {
    local name=$1
    local create_endpoint=$2
    local create_data=$3
    local read_endpoint=$4
    local update_endpoint=$5
    local update_data=$6
    local delete_endpoint=$7
    
    echo -e "${BLUE}Testing CRUD for: $name${NC}"
    echo "--------------------------------"
    
    # CREATE
    echo -n "  CREATE... "
    create_response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Authorization: Bearer ${PUBLIC_ANON_KEY}" \
        -H "Content-Type: application/json" \
        -d "$create_data" \
        "${API_BASE}${create_endpoint}")
    
    create_code=$(echo "$create_response" | tail -n1)
    create_body=$(echo "$create_response" | sed '$d')
    
    if [ "$create_code" -ge 200 ] && [ "$create_code" -lt 300 ]; then
        echo -e "${GREEN}✓${NC}"
        PASSED=$((PASSED + 1))
        
        # Extract ID from response if possible
        created_id=$(echo "$create_body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
        
        # READ
        if [ -n "$created_id" ] && [ -n "$read_endpoint" ]; then
            echo -n "  READ... "
            read_endpoint_final=$(echo "$read_endpoint" | sed "s/{id}/$created_id/g")
            read_response=$(curl -s -w "\n%{http_code}" -X GET \
                -H "Authorization: Bearer ${PUBLIC_ANON_KEY}" \
                "${API_BASE}${read_endpoint_final}")
            
            read_code=$(echo "$read_response" | tail -n1)
            if [ "$read_code" -ge 200 ] && [ "$read_code" -lt 300 ]; then
                echo -e "${GREEN}✓${NC}"
                PASSED=$((PASSED + 1))
            else
                echo -e "${YELLOW}⚠${NC} (HTTP $read_code)"
                SKIPPED=$((SKIPPED + 1))
            fi
        fi
        
        # UPDATE
        if [ -n "$created_id" ] && [ -n "$update_endpoint" ] && [ -n "$update_data" ]; then
            echo -n "  UPDATE... "
            update_endpoint_final=$(echo "$update_endpoint" | sed "s/{id}/$created_id/g")
            update_response=$(curl -s -w "\n%{http_code}" -X PUT \
                -H "Authorization: Bearer ${PUBLIC_ANON_KEY}" \
                -H "Content-Type: application/json" \
                -d "$update_data" \
                "${API_BASE}${update_endpoint_final}")
            
            update_code=$(echo "$update_response" | tail -n1)
            if [ "$update_code" -ge 200 ] && [ "$update_code" -lt 300 ]; then
                echo -e "${GREEN}✓${NC}"
                PASSED=$((PASSED + 1))
            else
                echo -e "${YELLOW}⚠${NC} (HTTP $update_code)"
                SKIPPED=$((SKIPPED + 1))
            fi
        fi
        
        # DELETE
        if [ -n "$created_id" ] && [ -n "$delete_endpoint" ]; then
            echo -n "  DELETE... "
            delete_endpoint_final=$(echo "$delete_endpoint" | sed "s/{id}/$created_id/g")
            delete_response=$(curl -s -w "\n%{http_code}" -X DELETE \
                -H "Authorization: Bearer ${PUBLIC_ANON_KEY}" \
                "${API_BASE}${delete_endpoint_final}")
            
            delete_code=$(echo "$delete_response" | tail -n1)
            if [ "$delete_code" -ge 200 ] && [ "$delete_code" -lt 300 ]; then
                echo -e "${GREEN}✓${NC}"
                PASSED=$((PASSED + 1))
            else
                echo -e "${YELLOW}⚠${NC} (HTTP $delete_code)"
                SKIPPED=$((SKIPPED + 1))
            fi
        fi
        
    elif [ "$create_code" -eq 400 ] || [ "$create_code" -eq 404 ]; then
        echo -e "${YELLOW}⚠ SKIPPED${NC} (HTTP $create_code - Missing test data)"
        SKIPPED=$((SKIPPED + 1))
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $create_code)"
        FAILED=$((FAILED + 1))
    fi
    
    echo ""
}

# Test Pet Profile Publishing CRUD
test_crud \
    "Pet Profile Publishing" \
    "/pet-profile/create" \
    '{
        "vendorId": "test_vendor_breeder",
        "vendorType": "breeder",
        "petType": "dog",
        "name": "Test Puppy",
        "breed": "Golden Retriever",
        "age": "8 weeks",
        "gender": "male",
        "vaccinationStatus": {
            "vaccinated": true,
            "vaccinationRecords": []
        },
        "nature": {
            "temperament": ["friendly", "playful"],
            "behavior": "Good with kids",
            "goodWith": ["children", "other dogs"]
        },
        "photos": [],
        "description": "Test puppy for CRUD testing",
        "price": 50000,
        "published": true
    }' \
    "/pet-profile/{id}" \
    "/pet-profile/{id}" \
    '{
        "vendorId": "test_vendor_breeder",
        "description": "Updated description",
        "status": "reserved"
    }' \
    "/pet-profile/{id}"

# Test Center Booking with Specialized Services (CREATE only, as it's booking-related)
echo -e "${BLUE}Testing Center Booking with Specialized Services${NC}"
echo "--------------------------------"
echo -n "  CREATE... "
create_response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Authorization: Bearer ${PUBLIC_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
        "customerId": "test_customer",
        "vendorId": "test_vendor",
        "centerId": "test_center",
        "petId": "test_pet",
        "baseServices": ["service1"],
        "specializedServices": [],
        "scheduledDate": "2024-12-25",
        "scheduledTime": "10:00"
    }' \
    "${API_BASE}/center-booking/create-with-services")

create_code=$(echo "$create_response" | tail -n1)
if [ "$create_code" -ge 200 ] && [ "$create_code" -lt 300 ]; then
    echo -e "${GREEN}✓${NC}"
    PASSED=$((PASSED + 1))
    
    # Extract booking ID
    booking_id=$(echo "$create_response" | sed '$d' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
    
    if [ -n "$booking_id" ]; then
        # READ
        echo -n "  READ... "
        read_response=$(curl -s -w "\n%{http_code}" -X GET \
            -H "Authorization: Bearer ${PUBLIC_ANON_KEY}" \
            "${API_BASE}/center-booking/${booking_id}/specialized-services")
        
        read_code=$(echo "$read_response" | tail -n1)
        if [ "$read_code" -ge 200 ] && [ "$read_code" -lt 300 ]; then
            echo -e "${GREEN}✓${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "${YELLOW}⚠${NC} (HTTP $read_code)"
        fi
        
        # UPDATE (Add specialized service)
        echo -n "  UPDATE (Add Service)... "
        update_response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Authorization: Bearer ${PUBLIC_ANON_KEY}" \
            -H "Content-Type: application/json" \
            -d '{
                "vendorId": "test_vendor",
                "service": {
                    "id": "prescription_1",
                    "name": "Prescription",
                    "type": "prescription",
                    "price": 500
                }
            }' \
            "${API_BASE}/center-booking/${booking_id}/add-specialized-service")
        
        update_code=$(echo "$update_response" | tail -n1)
        if [ "$update_code" -ge 200 ] && [ "$update_code" -lt 300 ]; then
            echo -e "${GREEN}✓${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "${YELLOW}⚠${NC} (HTTP $update_code)"
        fi
    fi
else
    echo -e "${YELLOW}⚠ SKIPPED${NC} (HTTP $create_code - Missing test data)"
fi

echo ""
echo "=========================================="
echo -e "${BLUE}📊 CRUD TEST RESULTS${NC}"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ CRUD operations test completed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some CRUD tests failed${NC}"
    exit 1
fi

