#!/bin/bash

# ============================================================================
# WARMPAWZ PLATFORM - ENVIRONMENT SETUP SCRIPT
# ============================================================================
# This script helps set up environment variables for all applications
# Usage: ./setup-env.sh [development|staging|production]
# ============================================================================

set -e

ENVIRONMENT=${1:-development}

echo "🔧 Setting up environment variables for: $ENVIRONMENT"
echo "═══════════════════════════════════════════════════════════"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to create env file
create_env_file() {
    local app_dir=$1
    local env_content=$2
    local env_file="$app_dir/.env.local"
    
    if [ -f "$env_file" ]; then
        echo -e "${YELLOW}⚠️  $env_file already exists. Backing up...${NC}"
        mv "$env_file" "$env_file.backup.$(date +%Y%m%d%H%M%S)"
    fi
    
    echo "$env_content" > "$env_file"
    echo -e "${GREEN}✅ Created $env_file${NC}"
}

# Set API URL based on environment
case "$ENVIRONMENT" in
    development)
        API_URL="http://localhost:3000"
        RAZORPAY_KEY="rzp_test_xxxxxxxxxxxx"
        ;;
    staging)
        API_URL="https://staging-api.warmpawz.com"
        RAZORPAY_KEY="rzp_test_xxxxxxxxxxxx"
        ;;
    production)
        API_URL="https://api.warmpawz.com"
        RAZORPAY_KEY="rzp_live_xxxxxxxxxxxx"
        ;;
    *)
        echo -e "${RED}❌ Invalid environment. Use: development, staging, or production${NC}"
        exit 1
        ;;
esac

echo ""
echo "📝 Configuration:"
echo "   Environment: $ENVIRONMENT"
echo "   API URL: $API_URL"
echo "   Razorpay: $RAZORPAY_KEY"
echo ""

# Customer Web App
echo "📱 Setting up Customer Web App..."
CUSTOMER_WEB_ENV="# Warmpawz Customer Web - $ENVIRONMENT
NEXT_PUBLIC_API_BASE_URL=$API_URL
NEXT_PUBLIC_RAZORPAY_KEY_ID=$RAZORPAY_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
NEXT_PUBLIC_APP_NAME=Warmpawz
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENVIRONMENT=$ENVIRONMENT
NEXT_PUBLIC_ENABLE_GPS_TRACKING=true
NEXT_PUBLIC_ENABLE_VIDEO_CALL=true
NEXT_PUBLIC_ENABLE_WALLET=true
NEXT_PUBLIC_ENABLE_ECOMMERCE=true
NEXT_PUBLIC_SUPPORT_EMAIL=support@warmpawz.com
NEXT_PUBLIC_SUPPORT_PHONE=+91-XXXXXXXXXX"

create_env_file "apps/customer-web" "$CUSTOMER_WEB_ENV"

# Vendor Web App
echo "🏪 Setting up Vendor Web App..."
VENDOR_WEB_ENV="# Warmpawz Vendor Web - $ENVIRONMENT
NEXT_PUBLIC_API_BASE_URL=$API_URL
NEXT_PUBLIC_RAZORPAY_KEY_ID=$RAZORPAY_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
NEXT_PUBLIC_APP_NAME=Warmpawz Vendor
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENVIRONMENT=$ENVIRONMENT
NEXT_PUBLIC_ENABLE_GPS_TRACKING=true
NEXT_PUBLIC_ENABLE_VIDEO_CALL=true
NEXT_PUBLIC_ENABLE_BANK_VERIFICATION=true
NEXT_PUBLIC_SUPPORT_EMAIL=vendor-support@warmpawz.com
NEXT_PUBLIC_SUPPORT_PHONE=+91-XXXXXXXXXX"

create_env_file "apps/vendor-web" "$VENDOR_WEB_ENV"

# Admin Web App
echo "👨‍💼 Setting up Admin Web App..."
ADMIN_WEB_ENV="# Warmpawz Admin Web - $ENVIRONMENT
NEXT_PUBLIC_API_BASE_URL=$API_URL
NEXT_PUBLIC_ADMIN_AUTH_REQUIRED=true
NEXT_PUBLIC_APP_NAME=Warmpawz Admin
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENVIRONMENT=$ENVIRONMENT
NEXT_PUBLIC_ENABLE_VENDOR_APPROVAL=true
NEXT_PUBLIC_ENABLE_ROLE_MANAGEMENT=true
NEXT_PUBLIC_ENABLE_TIER_MANAGEMENT=true
NEXT_PUBLIC_ENABLE_REPORTS=true"

create_env_file "apps/admin-web" "$ADMIN_WEB_ENV"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Environment setup complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "   1. Update API keys in .env.local files"
echo "   2. Add your Google Maps API key"
echo "   3. Update Razorpay keys with your actual keys"
echo "   4. Review ENVIRONMENT_VARIABLES_SETUP.md for mobile apps"
echo ""
echo "🚀 To start development:"
echo "   cd apps/customer-web && npm run dev"
echo "   cd apps/vendor-web && npm run dev"
echo "   cd apps/admin-web && npm run dev"
echo ""

