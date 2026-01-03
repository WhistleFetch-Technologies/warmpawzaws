#!/bin/bash
# ============================================================================
# WARMPAWZ - ANDROID KEYSTORE GENERATION SCRIPT
# ============================================================================
# 
# This script generates release keystores for both Customer and Vendor apps
# Run this ONCE during initial setup. Store keystores securely!
#
# Usage: ./scripts/generate-android-keystores.sh
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}WARMPAWZ - Android Keystore Generator${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Check if keytool is available
if ! command -v keytool &> /dev/null; then
    echo -e "${RED}Error: keytool not found. Please install Java JDK.${NC}"
    exit 1
fi

# Create keystores directory
KEYSTORE_DIR="$PROJECT_ROOT/keystores"
mkdir -p "$KEYSTORE_DIR"

# ============================================================================
# CUSTOMER APP KEYSTORE
# ============================================================================
CUSTOMER_KEYSTORE="$KEYSTORE_DIR/warmpawz-customer.keystore"
CUSTOMER_ALIAS="warmpawz-customer"

if [ -f "$CUSTOMER_KEYSTORE" ]; then
    echo -e "${YELLOW}Customer keystore already exists at: $CUSTOMER_KEYSTORE${NC}"
    read -p "Do you want to regenerate it? (y/N): " REGEN_CUSTOMER
    if [ "$REGEN_CUSTOMER" != "y" ] && [ "$REGEN_CUSTOMER" != "Y" ]; then
        echo "Skipping customer keystore generation."
    else
        rm "$CUSTOMER_KEYSTORE"
    fi
fi

if [ ! -f "$CUSTOMER_KEYSTORE" ]; then
    echo ""
    echo -e "${GREEN}Generating Customer App Keystore...${NC}"
    echo "You will be prompted for keystore details."
    echo ""
    
    keytool -genkeypair -v \
        -storetype PKCS12 \
        -keystore "$CUSTOMER_KEYSTORE" \
        -alias "$CUSTOMER_ALIAS" \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000
    
    echo -e "${GREEN}✓ Customer keystore created: $CUSTOMER_KEYSTORE${NC}"
fi

# ============================================================================
# VENDOR APP KEYSTORE
# ============================================================================
VENDOR_KEYSTORE="$KEYSTORE_DIR/warmpawz-vendor.keystore"
VENDOR_ALIAS="warmpawz-vendor"

if [ -f "$VENDOR_KEYSTORE" ]; then
    echo -e "${YELLOW}Vendor keystore already exists at: $VENDOR_KEYSTORE${NC}"
    read -p "Do you want to regenerate it? (y/N): " REGEN_VENDOR
    if [ "$REGEN_VENDOR" != "y" ] && [ "$REGEN_VENDOR" != "Y" ]; then
        echo "Skipping vendor keystore generation."
    else
        rm "$VENDOR_KEYSTORE"
    fi
fi

if [ ! -f "$VENDOR_KEYSTORE" ]; then
    echo ""
    echo -e "${GREEN}Generating Vendor App Keystore...${NC}"
    echo "You will be prompted for keystore details."
    echo ""
    
    keytool -genkeypair -v \
        -storetype PKCS12 \
        -keystore "$VENDOR_KEYSTORE" \
        -alias "$VENDOR_ALIAS" \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000
    
    echo -e "${GREEN}✓ Vendor keystore created: $VENDOR_KEYSTORE${NC}"
fi

# ============================================================================
# GENERATE KEYSTORE PROPERTIES FILES
# ============================================================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}Setting up keystore.properties files...${NC}"
echo -e "${GREEN}============================================${NC}"

# Prompt for passwords
echo ""
read -sp "Enter the Customer keystore password you used: " CUSTOMER_PASSWORD
echo ""
read -sp "Enter the Vendor keystore password you used: " VENDOR_PASSWORD
echo ""

# Customer keystore.properties
CUSTOMER_PROPS="$PROJECT_ROOT/apps/WarmpawzCustomer/android/keystore.properties"
cat > "$CUSTOMER_PROPS" << EOF
# Auto-generated keystore properties
# DO NOT commit this file to source control!
MYAPP_RELEASE_STORE_FILE=$CUSTOMER_KEYSTORE
MYAPP_RELEASE_STORE_PASSWORD=$CUSTOMER_PASSWORD
MYAPP_RELEASE_KEY_ALIAS=$CUSTOMER_ALIAS
MYAPP_RELEASE_KEY_PASSWORD=$CUSTOMER_PASSWORD
EOF
echo -e "${GREEN}✓ Created: $CUSTOMER_PROPS${NC}"

# Vendor keystore.properties
VENDOR_PROPS="$PROJECT_ROOT/apps/WarmpawzVendor/android/keystore.properties"
cat > "$VENDOR_PROPS" << EOF
# Auto-generated keystore properties
# DO NOT commit this file to source control!
MYAPP_RELEASE_STORE_FILE=$VENDOR_KEYSTORE
MYAPP_RELEASE_STORE_PASSWORD=$VENDOR_PASSWORD
MYAPP_RELEASE_KEY_ALIAS=$VENDOR_ALIAS
MYAPP_RELEASE_KEY_PASSWORD=$VENDOR_PASSWORD
EOF
echo -e "${GREEN}✓ Created: $VENDOR_PROPS${NC}"

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}KEYSTORE GENERATION COMPLETE${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Keystores created in: $KEYSTORE_DIR/"
echo ""
echo -e "${YELLOW}IMPORTANT SECURITY NOTES:${NC}"
echo "1. Store keystores in a secure location (not in git)"
echo "2. Back up keystores - if lost, you cannot update your apps!"
echo "3. For CI/CD, use GitHub Secrets or AWS Secrets Manager"
echo ""
echo -e "${GREEN}Next step: Run ./scripts/build-mobile-apps.sh${NC}"

