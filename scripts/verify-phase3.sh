#!/bin/bash

# ============================================================================
# PHASE 3 VERIFICATION SCRIPT: Video Call Integration
# ============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 3: Video Call Integration Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if AWS Chime SDK is installed
echo -e "${YELLOW}Checking dependencies...${NC}"
if [ -f "apps/customer-web/package.json" ]; then
    if grep -q "amazon-chime-sdk-js" apps/customer-web/package.json; then
        echo -e "  ${GREEN}✓${NC} amazon-chime-sdk-js found in customer-web"
    else
        echo -e "  ${RED}✗${NC} amazon-chime-sdk-js not found in customer-web"
    fi
fi

# Check if backend video call endpoints exist
echo -e "${YELLOW}Checking backend endpoints...${NC}"
if grep -q "create-meeting" backend/lambda/src/endpoints/video-call.ts; then
    echo -e "  ${GREEN}✓${NC} POST /video-call/create-meeting endpoint exists"
else
    echo -e "  ${RED}✗${NC} POST /video-call/create-meeting endpoint missing"
fi

if grep -q "video-call/join" backend/lambda/src/endpoints/video-call.ts; then
    echo -e "  ${GREEN}✓${NC} POST /video-call/join endpoint exists"
else
    echo -e "  ${RED}✗${NC} POST /video-call/join endpoint missing"
fi

if grep -q "video-call/end" backend/lambda/src/endpoints/video-call.ts; then
    echo -e "  ${GREEN}✓${NC} POST /video-call/end endpoint exists"
else
    echo -e "  ${RED}✗${NC} POST /video-call/end endpoint missing"
fi

# Check if frontend components exist
echo -e "${YELLOW}Checking frontend components...${NC}"
if [ -f "apps/customer-web/components/customer/video/VideoCallInterface.tsx" ]; then
    echo -e "  ${GREEN}✓${NC} VideoCallInterface component exists"
else
    echo -e "  ${RED}✗${NC} VideoCallInterface component missing"
fi

if grep -q "VideoCallInterface" apps/customer-web/app/video/\[bookingId\]/VideoPageClient.tsx; then
    echo -e "  ${GREEN}✓${NC} VideoPageClient uses VideoCallInterface"
else
    echo -e "  ${RED}✗${NC} VideoPageClient does not use VideoCallInterface"
fi

if grep -q "Start Video Call" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
    echo -e "  ${GREEN}✓${NC} AppointmentDetailModal has Start Video Call button"
else
    echo -e "  ${RED}✗${NC} AppointmentDetailModal missing Start Video Call button"
fi

# Check if migration exists
echo -e "${YELLOW}Checking database migration...${NC}"
if [ -f "db/migrations/304_add_video_call_fields.sql" ]; then
    echo -e "  ${GREEN}✓${NC} Migration 304_add_video_call_fields.sql exists"
else
    echo -e "  ${RED}✗${NC} Migration 304_add_video_call_fields.sql missing"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Phase 3 Verification Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
