#!/bin/bash

# ============================================
# CLINIC-DOCTOR SYSTEM TEST SCRIPT
# ============================================
# 
# This script tests the complete clinic-doctor system
# Run this to verify all endpoints are working correctly
#
# Usage: bash CLINIC_DOCTOR_TEST_SCRIPT.sh
#
# Prerequisites:
# - Set SUPABASE_PROJECT_ID environment variable
# - Set SUPABASE_ANON_KEY environment variable
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check environment variables
if [ -z "$SUPABASE_PROJECT_ID" ]; then
    echo -e "${RED}Error: SUPABASE_PROJECT_ID not set${NC}"
    echo "Run: export SUPABASE_PROJECT_ID=your_project_id"
    exit 1
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo -e "${RED}Error: SUPABASE_ANON_KEY not set${NC}"
    echo "Run: export SUPABASE_ANON_KEY=your_anon_key"
    exit 1
fi

API_BASE="https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475"
AUTH_HEADER="Authorization: Bearer ${SUPABASE_ANON_KEY}"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  CLINIC-DOCTOR SYSTEM TEST${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "${YELLOW}API Base: ${API_BASE}${NC}"
echo ""

# ============================================
# TEST 1: Create Clinic
# ============================================
echo -e "${YELLOW}[TEST 1] Creating clinic...${NC}"

CLINIC_RESPONSE=$(curl -s -X POST "${API_BASE}/clinic/create" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Vet Clinic - Automated",
    "ownerName": "Dr. Test Owner",
    "phone": "9999999990",
    "email": "test.clinic@warmpawz.com",
    "address": "123 Automated Test Street",
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560001",
    "roleId": "veterinary_clinic",
    "facilities": {
      "icuAvailable": true,
      "xrayAvailable": true
    },
    "operatingHours": {
      "monday": "9 AM - 6 PM",
      "tuesday": "9 AM - 6 PM",
      "wednesday": "9 AM - 6 PM",
      "thursday": "9 AM - 6 PM",
      "friday": "9 AM - 6 PM",
      "saturday": "9 AM - 2 PM",
      "sunday": "Closed"
    }
  }')

CLINIC_ID=$(echo $CLINIC_RESPONSE | grep -o '"clinicId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$CLINIC_ID" ]; then
    echo -e "${RED}✗ Failed to create clinic${NC}"
    echo "Response: $CLINIC_RESPONSE"
    exit 1
else
    echo -e "${GREEN}✓ Clinic created successfully${NC}"
    echo -e "  Clinic ID: ${CLINIC_ID}"
fi

echo ""

# ============================================
# TEST 2: Add Doctor to Clinic
# ============================================
echo -e "${YELLOW}[TEST 2] Adding doctor to clinic...${NC}"

DOCTOR_RESPONSE=$(curl -s -X POST "${API_BASE}/doctor/create" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Dr. Automated Test\",
    \"email\": \"automated.doctor@warmpawz.com\",
    \"phone\": \"9999999991\",
    \"password\": \"test123456\",
    \"specialization\": [\"General Practice\", \"Surgery\"],
    \"experience\": 8,
    \"qualifications\": \"BVSc, MVSc\",
    \"about\": \"Automated test doctor profile for clinic-doctor system verification\",
    \"clinicId\": \"${CLINIC_ID}\",
    \"consultationFee\": 600
  }")

DOCTOR_ID=$(echo $DOCTOR_RESPONSE | grep -o '"doctorId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$DOCTOR_ID" ]; then
    echo -e "${RED}✗ Failed to add doctor${NC}"
    echo "Response: $DOCTOR_RESPONSE"
    exit 1
else
    echo -e "${GREEN}✓ Doctor added successfully${NC}"
    echo -e "  Doctor ID: ${DOCTOR_ID}"
fi

echo ""

# ============================================
# TEST 3: Get Clinic with Doctors
# ============================================
echo -e "${YELLOW}[TEST 3] Fetching clinic with doctors...${NC}"

CLINIC_DATA=$(curl -s -X GET "${API_BASE}/clinic/${CLINIC_ID}" \
  -H "${AUTH_HEADER}")

DOCTOR_COUNT=$(echo $CLINIC_DATA | grep -o '"totalDoctors":[0-9]*' | cut -d':' -f2)

if [ "$DOCTOR_COUNT" = "1" ]; then
    echo -e "${GREEN}✓ Clinic has 1 doctor as expected${NC}"
else
    echo -e "${RED}✗ Expected 1 doctor, found ${DOCTOR_COUNT}${NC}"
    echo "Response: $CLINIC_DATA"
    exit 1
fi

echo ""

# ============================================
# TEST 4: Get Doctor Profile
# ============================================
echo -e "${YELLOW}[TEST 4] Fetching doctor profile...${NC}"

DOCTOR_DATA=$(curl -s -X GET "${API_BASE}/doctor/${DOCTOR_ID}" \
  -H "${AUTH_HEADER}")

DOCTOR_NAME=$(echo $DOCTOR_DATA | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ "$DOCTOR_NAME" = "Dr. Automated Test" ]; then
    echo -e "${GREEN}✓ Doctor profile fetched successfully${NC}"
    echo -e "  Name: ${DOCTOR_NAME}"
else
    echo -e "${RED}✗ Failed to fetch doctor profile${NC}"
    echo "Response: $DOCTOR_DATA"
    exit 1
fi

echo ""

# ============================================
# TEST 5: Update Doctor Profile
# ============================================
echo -e "${YELLOW}[TEST 5] Updating doctor profile...${NC}"

UPDATE_RESPONSE=$(curl -s -X PUT "${API_BASE}/doctor/${DOCTOR_ID}" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{
    "consultationFee": 800,
    "about": "Updated doctor profile for testing"
  }')

UPDATE_SUCCESS=$(echo $UPDATE_RESPONSE | grep -o '"success":true')

if [ -n "$UPDATE_SUCCESS" ]; then
    echo -e "${GREEN}✓ Doctor profile updated successfully${NC}"
else
    echo -e "${RED}✗ Failed to update doctor profile${NC}"
    echo "Response: $UPDATE_RESPONSE"
    exit 1
fi

echo ""

# ============================================
# TEST 6: Configure Doctor Services
# ============================================
echo -e "${YELLOW}[TEST 6] Configuring doctor services...${NC}"

SERVICES_RESPONSE=$(curl -s -X PUT "${API_BASE}/doctor/${DOCTOR_ID}/services" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d '{
    "services": [
      {
        "id": "service_1",
        "serviceName": "General Consultation",
        "price": 500,
        "duration": 30,
        "description": "Basic health checkup and consultation"
      },
      {
        "id": "service_2",
        "serviceName": "Vaccination",
        "price": 300,
        "duration": 15,
        "description": "Pet vaccination services"
      }
    ]
  }')

SERVICES_SUCCESS=$(echo $SERVICES_RESPONSE | grep -o '"success":true')

if [ -n "$SERVICES_SUCCESS" ]; then
    echo -e "${GREEN}✓ Doctor services configured successfully${NC}"
else
    echo -e "${RED}✗ Failed to configure doctor services${NC}"
    echo "Response: $SERVICES_RESPONSE"
    exit 1
fi

echo ""

# ============================================
# TEST 7: Get Doctor's Services
# ============================================
echo -e "${YELLOW}[TEST 7] Fetching doctor's services...${NC}"

DOCTOR_SERVICES=$(curl -s -X GET "${API_BASE}/doctor/${DOCTOR_ID}/services" \
  -H "${AUTH_HEADER}")

SERVICE_COUNT=$(echo $DOCTOR_SERVICES | grep -o '"id":"service_' | wc -l)

if [ "$SERVICE_COUNT" -ge "2" ]; then
    echo -e "${GREEN}✓ Doctor services fetched successfully${NC}"
    echo -e "  Services: ${SERVICE_COUNT}"
else
    echo -e "${RED}✗ Expected 2+ services, found ${SERVICE_COUNT}${NC}"
    echo "Response: $DOCTOR_SERVICES"
    exit 1
fi

echo ""

# ============================================
# TEST 8: Get Clinic's Doctors (Customer View)
# ============================================
echo -e "${YELLOW}[TEST 8] Fetching clinic's doctors (customer view)...${NC}"

CLINIC_DOCTORS=$(curl -s -X GET "${API_BASE}/clinic/${CLINIC_ID}/doctors" \
  -H "${AUTH_HEADER}")

CLINIC_DOCTORS_COUNT=$(echo $CLINIC_DOCTORS | grep -o '"total":[0-9]*' | cut -d':' -f2)

if [ "$CLINIC_DOCTORS_COUNT" = "1" ]; then
    echo -e "${GREEN}✓ Clinic doctors list fetched successfully${NC}"
else
    echo -e "${RED}✗ Expected 1 doctor in list, found ${CLINIC_DOCTORS_COUNT}${NC}"
    echo "Response: $CLINIC_DOCTORS"
    exit 1
fi

echo ""

# ============================================
# TEST 9: Get All Clinics (Browse)
# ============================================
echo -e "${YELLOW}[TEST 9] Browsing all clinics...${NC}"

ALL_CLINICS=$(curl -s -X GET "${API_BASE}/clinics?roleId=veterinary_clinic" \
  -H "${AUTH_HEADER}")

CLINICS_COUNT=$(echo $ALL_CLINICS | grep -o '"total":[0-9]*' | cut -d':' -f2)

if [ -n "$CLINICS_COUNT" ]; then
    echo -e "${GREEN}✓ Clinics list fetched successfully${NC}"
    echo -e "  Total clinics: ${CLINICS_COUNT}"
else
    echo -e "${RED}✗ Failed to fetch clinics list${NC}"
    echo "Response: $ALL_CLINICS"
    exit 1
fi

echo ""

# ============================================
# TEST 10: Add Second Doctor
# ============================================
echo -e "${YELLOW}[TEST 10] Adding second doctor to clinic...${NC}"

DOCTOR2_RESPONSE=$(curl -s -X POST "${API_BASE}/doctor/create" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Dr. Second Test\",
    \"email\": \"second.doctor@warmpawz.com\",
    \"phone\": \"9999999992\",
    \"password\": \"test123456\",
    \"specialization\": [\"Cardiology\"],
    \"experience\": 12,
    \"qualifications\": \"BVSc, MD\",
    \"about\": \"Cardiologist for testing\",
    \"clinicId\": \"${CLINIC_ID}\",
    \"consultationFee\": 1000
  }")

DOCTOR2_ID=$(echo $DOCTOR2_RESPONSE | grep -o '"doctorId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$DOCTOR2_ID" ]; then
    echo -e "${RED}✗ Failed to add second doctor${NC}"
    echo "Response: $DOCTOR2_RESPONSE"
    exit 1
else
    echo -e "${GREEN}✓ Second doctor added successfully${NC}"
    echo -e "  Doctor ID: ${DOCTOR2_ID}"
fi

echo ""

# ============================================
# TEST 11: Verify Clinic Has 2 Doctors
# ============================================
echo -e "${YELLOW}[TEST 11] Verifying clinic has 2 doctors...${NC}"

CLINIC_DATA_UPDATED=$(curl -s -X GET "${API_BASE}/clinic/${CLINIC_ID}" \
  -H "${AUTH_HEADER}")

DOCTOR_COUNT_UPDATED=$(echo $CLINIC_DATA_UPDATED | grep -o '"totalDoctors":[0-9]*' | cut -d':' -f2)

if [ "$DOCTOR_COUNT_UPDATED" = "2" ]; then
    echo -e "${GREEN}✓ Clinic has 2 doctors as expected${NC}"
else
    echo -e "${RED}✗ Expected 2 doctors, found ${DOCTOR_COUNT_UPDATED}${NC}"
    echo "Response: $CLINIC_DATA_UPDATED"
    exit 1
fi

echo ""

# ============================================
# TEST 12: Remove Doctor from Clinic
# ============================================
echo -e "${YELLOW}[TEST 12] Removing second doctor from clinic...${NC}"

REMOVE_RESPONSE=$(curl -s -X DELETE "${API_BASE}/clinic/${CLINIC_ID}/doctor/${DOCTOR2_ID}" \
  -H "${AUTH_HEADER}")

REMOVE_SUCCESS=$(echo $REMOVE_RESPONSE | grep -o '"success":true')

if [ -n "$REMOVE_SUCCESS" ]; then
    echo -e "${GREEN}✓ Doctor removed successfully${NC}"
else
    echo -e "${RED}✗ Failed to remove doctor${NC}"
    echo "Response: $REMOVE_RESPONSE"
    exit 1
fi

echo ""

# ============================================
# SUMMARY
# ============================================
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}ALL TESTS PASSED! ✓${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "${YELLOW}Test Summary:${NC}"
echo -e "  ✓ Clinic creation"
echo -e "  ✓ Doctor addition"
echo -e "  ✓ Clinic-doctor association"
echo -e "  ✓ Doctor profile fetching"
echo -e "  ✓ Doctor profile updating"
echo -e "  ✓ Doctor services configuration"
echo -e "  ✓ Doctor services retrieval"
echo -e "  ✓ Customer clinic browsing"
echo -e "  ✓ Customer doctor viewing"
echo -e "  ✓ Multi-doctor support"
echo -e "  ✓ Doctor removal"
echo ""
echo -e "${YELLOW}Created Resources:${NC}"
echo -e "  Clinic ID: ${CLINIC_ID}"
echo -e "  Doctor ID: ${DOCTOR_ID}"
echo ""
echo -e "${GREEN}The clinic-doctor system is fully functional!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "  1. Test the frontend components"
echo -e "  2. Create a booking with doctorId"
echo -e "  3. Test lobby notification"
echo -e "  4. Verify doctor dashboard"
echo ""
