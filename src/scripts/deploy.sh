#!/bin/bash

# Warmpawz Edge Function Quick Deploy Script
# Run this script to deploy the Edge Function to Supabase

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Warmpawz Edge Function Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase >/dev/null 2>&1; then
    echo -e "${RED}❌ Supabase CLI is not installed${NC}"
    echo ""
    echo "Install it with:"
    echo "  npm install -g supabase"
    echo ""
    echo "Or see: https://supabase.com/docs/guides/cli"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI found${NC}"
echo ""

# Check if project is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo -e "${YELLOW}⚠️  Project not linked${NC}"
    echo ""
    echo "Linking to project: vpvpbdwtyugbknrntkho"
    echo ""
    supabase link --project-ref vpvpbdwtyugbknrntkho
    echo ""
fi

echo -e "${GREEN}✅ Project linked${NC}"
echo ""

# Deploy function
echo -e "${BLUE}📦 Deploying 'server' Edge Function...${NC}"
echo ""

supabase functions deploy server

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Test the deployment
echo -e "${BLUE}🧪 Testing deployment...${NC}"
echo ""

HEALTH_URL="https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/health"

if command -v curl >/dev/null 2>&1; then
    RESPONSE=$(curl -s -w "\n%{http_code}" "$HEALTH_URL")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Health check passed!${NC}"
        echo ""
        echo "Your Edge Function is now live at:"
        echo "  https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475"
    else
        echo -e "${YELLOW}⚠️  Health check returned HTTP $HTTP_CODE${NC}"
        echo "The function may still be starting up. Wait a minute and try again."
    fi
else
    echo -e "${YELLOW}ℹ️  curl not found, skipping health check${NC}"
fi

echo ""
echo -e "${BLUE}📊 Next Steps:${NC}"
echo "  1. Open your app and test vendor onboarding"
echo "  2. Check function logs: supabase functions logs server --tail"
echo "  3. View in dashboard: https://app.supabase.com/project/vpvpbdwtyugbknrntkho/functions"
echo ""
echo -e "${BLUE}🧪 Run verification tests:${NC}"
echo "  chmod +x scripts/verify-deployment.sh"
echo "  export SUPABASE_ANON_KEY=your_key_here"
echo "  ./scripts/verify-deployment.sh"
echo ""
