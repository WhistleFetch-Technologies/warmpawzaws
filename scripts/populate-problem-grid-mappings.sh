#!/bin/bash

# ============================================================================
# Populate Problem Grid Mappings Script
# ============================================================================
# Calls the admin endpoint to populate problem_grid_mappings table
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Populate Problem Grid Mappings${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Check for required environment variables
if [ -z "$SUPABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_URL not set. Loading from .env...${NC}"
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
fi

if [ -z "$SUPABASE_URL" ]; then
    echo -e "${RED}❌ SUPABASE_URL not found. Please set it or create .env file.${NC}"
    exit 1
fi

if [ -z "$SUPABASE_ANON_KEY" ] && [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}⚠️  No API key found. Loading from .env...${NC}"
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
fi

# Use service role key if available, otherwise anon key
API_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$SUPABASE_ANON_KEY}"

if [ -z "$API_KEY" ]; then
    echo -e "${RED}❌ No API key found. Please set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.${NC}"
    exit 1
fi

# Extract project ID from URL
PROJECT_ID=$(echo $SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Could not extract project ID from SUPABASE_URL${NC}"
    exit 1
fi

ENDPOINT_URL="${SUPABASE_URL}/functions/v1/make-server-3dd53475/admin/populate-problem-grid-mappings"

echo -e "${BLUE}Calling endpoint:${NC}"
echo "   URL: $ENDPOINT_URL"
echo "   Method: POST"
echo ""

# Make the API call
echo -e "${BLUE}Populating problem grid mappings...${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -H "apikey: $API_KEY")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo ""
if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Success!${NC}"
    echo ""
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    
    # Extract counts from response
    INSERTED=$(echo "$BODY" | grep -o '"inserted":[0-9]*' | cut -d':' -f2 || echo "0")
    ERRORS=$(echo "$BODY" | grep -o '"errors":[0-9]*' | cut -d':' -f2 || echo "0")
    
    echo ""
    echo -e "${GREEN}Summary:${NC}"
    echo "   Inserted: $INSERTED mappings"
    echo "   Errors: $ERRORS"
    
    if [ "$ERRORS" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Some errors occurred. Check the response above.${NC}"
    fi
else
    echo -e "${RED}❌ Error (HTTP $HTTP_CODE)${NC}"
    echo ""
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi

echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ Problem grid mappings populated!${NC}"
echo -e "${BLUE}============================================================================${NC}"

