#!/bin/bash

# ============================================
# DEPLOY VENDOR NOTIFICATION FIX
# ============================================
# This script deploys the vendor notification endpoint fix
# to resolve "Failed to fetch" errors

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  DEPLOYING VENDOR NOTIFICATION FIX${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -d "supabase/functions" ]; then
    echo -e "${RED}Error: supabase/functions directory not found${NC}"
    echo -e "${YELLOW}Please run this script from your project root${NC}"
    exit 1
fi

# Check if index.tsx exists
if [ ! -f "supabase/functions/server/index.tsx" ]; then
    echo -e "${RED}Error: supabase/functions/server/index.tsx not found${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Verifying notification endpoints exist...${NC}"

# Check if the notification endpoint exists in the code
if grep -q "GET.*\/vendor\/notifications\/:vendorId" supabase/functions/server/index.tsx; then
    echo -e "${GREEN}✓ Notification endpoints found in code${NC}"
else
    echo -e "${RED}✗ Notification endpoints not found in code${NC}"
    echo -e "${YELLOW}Please ensure the fix has been applied to index.tsx${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Checking function directory name...${NC}"

# Check if directory is named correctly
if [ -d "supabase/functions/make-server-3dd53475" ]; then
    echo -e "${GREEN}✓ Function directory correctly named: make-server-3dd53475${NC}"
    FUNCTION_NAME="make-server-3dd53475"
elif [ -d "supabase/functions/server" ]; then
    echo -e "${YELLOW}⚠ Function directory named 'server', should be 'make-server-3dd53475'${NC}"
    echo -e "${YELLOW}Renaming directory...${NC}"
    
    # Backup first
    if [ -d "supabase/functions/make-server-3dd53475" ]; then
        echo -e "${YELLOW}Backing up existing make-server-3dd53475...${NC}"
        mv supabase/functions/make-server-3dd53475 supabase/functions/make-server-3dd53475-backup-$(date +%Y%m%d-%H%M%S)
    fi
    
    # Rename
    mv supabase/functions/server supabase/functions/make-server-3dd53475
    echo -e "${GREEN}✓ Renamed to make-server-3dd53475${NC}"
    FUNCTION_NAME="make-server-3dd53475"
else
    echo -e "${RED}✗ Cannot find function directory${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 3: Deploying function to Supabase...${NC}"

# Deploy the function
npx supabase functions deploy $FUNCTION_NAME

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Function deployed successfully!${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    echo -e "${YELLOW}Please check the error messages above${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 4: Testing the endpoint...${NC}"

# Ask for project credentials
echo -e "${YELLOW}Enter your Supabase Project ID (or press Enter to skip test):${NC}"
read PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}Skipping endpoint test${NC}"
else
    echo -e "${YELLOW}Enter your Supabase Anon Key:${NC}"
    read ANON_KEY
    
    echo -e "${YELLOW}Enter a vendor ID to test (e.g., vendor_9876543216):${NC}"
    read VENDOR_ID
    
    if [ -n "$ANON_KEY" ] && [ -n "$VENDOR_ID" ]; then
        echo -e "${BLUE}Testing endpoint...${NC}"
        
        RESPONSE=$(curl -s -w "\n%{http_code}" \
          "https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/vendor/notifications/${VENDOR_ID}?limit=5" \
          -H "Authorization: Bearer ${ANON_KEY}")
        
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        BODY=$(echo "$RESPONSE" | head -n-1)
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo -e "${GREEN}✓ Endpoint is working! (HTTP 200)${NC}"
            echo -e "${BLUE}Response:${NC}"
            echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
        else
            echo -e "${RED}✗ Endpoint returned HTTP ${HTTP_CODE}${NC}"
            echo -e "${YELLOW}Response:${NC}"
            echo "$BODY"
        fi
    fi
fi

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}DEPLOYMENT COMPLETE!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Refresh your vendor app"
echo -e "  2. Check the browser console - errors should be gone"
echo -e "  3. Look for success logs: ${GREEN}✅ [VENDOR-NOTIFICATIONS]${NC}"
echo ""
echo -e "${BLUE}What was fixed:${NC}"
echo -e "  ✅ Added GET /vendor/notifications/:vendorId"
echo -e "  ✅ Added POST /vendor/notifications/:vendorId/:notificationId/read"
echo -e "  ✅ Added DELETE /vendor/notifications/:vendorId"
echo ""
echo -e "${GREEN}The 'Failed to fetch' errors should now be resolved!${NC}"
echo ""
