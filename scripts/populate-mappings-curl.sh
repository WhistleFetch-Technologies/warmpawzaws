#!/bin/bash

# ============================================================================
# Populate Problem Grid Mappings - Direct cURL Command
# ============================================================================
# Option 2: Direct cURL method
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Populate Problem Grid Mappings - Direct cURL${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Get Supabase URL
if [ -z "$SUPABASE_URL" ]; then
    echo -e "${YELLOW}Enter your Supabase project URL:${NC}"
    echo "   Example: https://abcdefghijklmnop.supabase.co"
    read -p "   SUPABASE_URL: " SUPABASE_URL
fi

# Get Service Role Key
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo ""
    echo -e "${YELLOW}Enter your Supabase Service Role Key:${NC}"
    echo "   (Find it in: Supabase Dashboard → Settings → API → service_role key)"
    read -p "   SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ Missing required values${NC}"
    exit 1
fi

# Build endpoint URL
ENDPOINT_URL="${SUPABASE_URL}/functions/v1/make-server-3dd53475/admin/populate-problem-grid-mappings"

echo ""
echo -e "${BLUE}Calling endpoint:${NC}"
echo "   URL: $ENDPOINT_URL"
echo "   Method: POST"
echo ""

# Make the API call
echo -e "${BLUE}Populating problem grid mappings...${NC}"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo ""
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Success! (HTTP $HTTP_CODE)${NC}"
    echo ""
    
    # Try to parse JSON, fallback to raw output
    if command -v jq &> /dev/null; then
        echo "$BODY" | jq '.'
        
        INSERTED=$(echo "$BODY" | jq -r '.inserted // 0')
        ERRORS=$(echo "$BODY" | jq -r '.errors // 0')
    else
        echo "$BODY"
        INSERTED=$(echo "$BODY" | grep -o '"inserted":[0-9]*' | cut -d':' -f2 || echo "0")
        ERRORS=$(echo "$BODY" | grep -o '"errors":[0-9]*' | cut -d':' -f2 || echo "0")
    fi
    
    echo ""
    echo -e "${GREEN}Summary:${NC}"
    echo "   ✅ Inserted: $INSERTED mappings"
    echo "   ⚠️  Errors: $ERRORS"
    
    if [ "$ERRORS" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Some errors occurred. Check the response above.${NC}"
    else
        echo -e "${GREEN}✅ All mappings populated successfully!${NC}"
    fi
else
    echo -e "${RED}❌ Error (HTTP $HTTP_CODE)${NC}"
    echo ""
    echo "$BODY"
    
    if [ "$HTTP_CODE" -eq 404 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Endpoint not found. Make sure:${NC}"
        echo "   1. Functions are deployed: supabase functions deploy make-server-3dd53475"
        echo "   2. Endpoint is registered in index.tsx"
    elif [ "$HTTP_CODE" -eq 401 ] || [ "$HTTP_CODE" -eq 403 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Authentication failed. Check your Service Role Key.${NC}"
    elif [ "$HTTP_CODE" -eq 500 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Server error. Check:${NC}"
        echo "   1. Migration 010 is applied"
        echo "   2. Function logs for details"
    fi
    
    exit 1
fi

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ Problem grid mappings populated!${NC}"
echo -e "${BLUE}============================================================================${NC}"

