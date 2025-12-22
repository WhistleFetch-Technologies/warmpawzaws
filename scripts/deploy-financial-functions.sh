#!/bin/bash

# ============================================================================
# Deploy Financial Functions Script
# ============================================================================
# Deploys the make-server-3dd53475 function with all financial fixes
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Financial Functions Deployment${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found!${NC}"
    echo ""
    echo "Install Supabase CLI:"
    echo "  npm install -g supabase"
    echo "  or"
    echo "  brew install supabase/tap/supabase"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI found${NC}"

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase${NC}"
    echo ""
    echo "Please login:"
    echo "  supabase login"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Logged in to Supabase${NC}"

# Check if function directory exists
FUNCTION_DIR="supabase/functions/make-server-3dd53475"
if [ ! -d "$FUNCTION_DIR" ]; then
    echo -e "${RED}❌ Function directory not found: $FUNCTION_DIR${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Function directory found${NC}"

# Check if index.tsx exists
if [ ! -f "$FUNCTION_DIR/index.tsx" ]; then
    echo -e "${RED}❌ index.tsx not found in function directory${NC}"
    exit 1
fi

echo -e "${GREEN}✅ index.tsx found${NC}"

# Verify key files are present
echo ""
echo "🔍 Verifying key files..."
KEY_FILES=(
    "../server/payment-endpoints-fixed.tsx"
    "../server/tier-upgrade-endpoints.tsx"
    "settlement-automation-sql.tsx"
)

cd "$FUNCTION_DIR"
for file in "${KEY_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $(basename $file) found${NC}"
    else
        echo -e "${YELLOW}⚠️  $(basename $file) not found (may be in different location)${NC}"
    fi
done

cd - > /dev/null

# Deploy function
echo ""
echo -e "${BLUE}Deploying function: make-server-3dd53475${NC}"
echo ""

# Check if linked to project
if [ -f ".supabase/config.toml" ]; then
    PROJECT_REF=$(grep -A 5 "\[project\]" .supabase/config.toml 2>/dev/null | grep "id" | cut -d '"' -f 2 || echo "")
    if [ -n "$PROJECT_REF" ]; then
        echo -e "${GREEN}✅ Project linked: $PROJECT_REF${NC}"
    fi
fi

# Deploy
echo "Deploying..."
if supabase functions deploy make-server-3dd53475 --no-verify-jwt; then
    echo ""
    echo -e "${GREEN}✅ Function deployed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Verify deployment:"
    echo "   supabase functions list"
    echo ""
    echo "2. Check logs:"
    echo "   supabase functions logs make-server-3dd53475"
    echo ""
    echo "3. Test endpoint:"
    echo "   curl https://<your-project>.supabase.co/functions/v1/make-server-3dd53475/payments/tiers"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Deployment failed!${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check you're logged in: supabase login"
    echo "2. Check project is linked: supabase link"
    echo "3. Check function directory exists"
    echo "4. Check for syntax errors in index.tsx"
    echo ""
    exit 1
fi

echo -e "${BLUE}============================================================================${NC}"
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${BLUE}============================================================================${NC}"

