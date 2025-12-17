#!/bin/bash

# Script to initialize React Native native projects
# This script creates the Android and iOS native folders

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CUSTOMER_APP="$ROOT_DIR/apps/customer-mobile"
VENDOR_APP="$ROOT_DIR/apps/vendor-mobile"

echo "🚀 Initializing React Native Native Projects..."

# Function to initialize native project
init_native_project() {
    local APP_DIR=$1
    local APP_NAME=$2
    
    echo ""
    echo "📱 Initializing $APP_NAME..."
    cd "$APP_DIR"
    
    # Check if android or ios folders already exist
    if [ -d "android" ] || [ -d "ios" ]; then
        echo "⚠️  Native folders already exist. Skipping..."
        return
    fi
    
    # Create a temporary React Native project to extract native folders
    TEMP_DIR=$(mktemp -d)
    echo "📦 Creating temporary React Native project..."
    
    cd "$TEMP_DIR"
    npx react-native@0.73.0 init "$APP_NAME" --skip-install --version 0.73.0
    
    # Copy native folders
    echo "📋 Copying native folders..."
    cp -r "$APP_NAME/android" "$APP_DIR/"
    cp -r "$APP_NAME/ios" "$APP_DIR/"
    
    # Clean up
    rm -rf "$TEMP_DIR"
    
    echo "✅ $APP_NAME native folders initialized"
}

# Initialize Customer App
if [ -d "$CUSTOMER_APP" ]; then
    init_native_project "$CUSTOMER_APP" "WarmpawzCustomer"
else
    echo "❌ Customer app directory not found: $CUSTOMER_APP"
fi

# Initialize Vendor App
if [ -d "$VENDOR_APP" ]; then
    init_native_project "$VENDOR_APP" "WarmpawzVendor"
else
    echo "❌ Vendor app directory not found: $VENDOR_APP"
fi

echo ""
echo "✅ Native project initialization complete!"
echo ""
echo "Next steps:"
echo "1. cd apps/customer-mobile && npm install"
echo "2. cd apps/vendor-mobile && npm install"
echo "3. cd apps/customer-mobile/ios && pod install (macOS only)"
echo "4. cd apps/vendor-mobile/ios && pod install (macOS only)"

