#!/bin/bash
# ============================================================================
# WARMPAWZ - MOBILE APP BUILD SCRIPT
# ============================================================================
# 
# Builds release APKs for Android and prepares iOS for Xcode build
#
# Usage: 
#   ./scripts/build-mobile-apps.sh           # Build all
#   ./scripts/build-mobile-apps.sh android   # Android only
#   ./scripts/build-mobile-apps.sh ios       # iOS only
#   ./scripts/build-mobile-apps.sh customer  # Customer app only
#   ./scripts/build-mobile-apps.sh vendor    # Vendor app only
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BUILD_TARGET="${1:-all}"

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}WARMPAWZ - Mobile App Builder${NC}"
echo -e "${GREEN}============================================${NC}"
echo "Build target: $BUILD_TARGET"
echo ""

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

check_android_setup() {
    if [ -z "$ANDROID_HOME" ]; then
        echo -e "${YELLOW}Warning: ANDROID_HOME not set. Android builds may fail.${NC}"
    fi
}

check_ios_setup() {
    if ! command -v pod &> /dev/null; then
        echo -e "${YELLOW}Warning: CocoaPods not found. iOS builds may fail.${NC}"
        echo "Install with: sudo gem install cocoapods"
    fi
}

install_npm_deps() {
    local APP_DIR=$1
    echo -e "${BLUE}Installing npm dependencies in $APP_DIR...${NC}"
    cd "$APP_DIR"
    npm install --legacy-peer-deps
}

build_android() {
    local APP_DIR=$1
    local APP_NAME=$2
    
    echo -e "${GREEN}Building Android APK for $APP_NAME...${NC}"
    cd "$APP_DIR/android"
    
    # Check for keystore.properties
    if [ ! -f "keystore.properties" ]; then
        echo -e "${YELLOW}Warning: keystore.properties not found.${NC}"
        echo "Run ./scripts/generate-android-keystores.sh first for signed release builds."
        echo "Building unsigned APK instead..."
        ./gradlew assembleRelease --no-daemon
    else
        echo "Using keystore.properties for signing..."
        ./gradlew assembleProductionRelease --no-daemon
    fi
    
    # Find and report APK location
    APK_PATH=$(find app/build/outputs/apk -name "*.apk" -type f 2>/dev/null | head -1)
    if [ -n "$APK_PATH" ]; then
        echo -e "${GREEN}✓ APK built: $APK_PATH${NC}"
        
        # Copy to output directory
        OUTPUT_DIR="$PROJECT_ROOT/build-output/android"
        mkdir -p "$OUTPUT_DIR"
        cp "$APK_PATH" "$OUTPUT_DIR/${APP_NAME}-release.apk"
        echo -e "${GREEN}✓ Copied to: $OUTPUT_DIR/${APP_NAME}-release.apk${NC}"
    else
        echo -e "${RED}APK not found in expected location${NC}"
    fi
}

build_ios() {
    local APP_DIR=$1
    local APP_NAME=$2
    
    echo -e "${GREEN}Preparing iOS build for $APP_NAME...${NC}"
    cd "$APP_DIR/ios"
    
    # Install CocoaPods dependencies
    echo "Installing CocoaPods dependencies..."
    pod install --repo-update
    
    echo -e "${GREEN}✓ iOS dependencies installed${NC}"
    echo ""
    echo -e "${YELLOW}To build iOS release:${NC}"
    echo "1. Open $APP_DIR/ios/*.xcworkspace in Xcode"
    echo "2. Select 'Generic iOS Device' as build target"
    echo "3. Product → Archive"
    echo "4. Distribute App → App Store Connect"
}

# ============================================================================
# MAIN BUILD LOGIC
# ============================================================================

# Check setup
check_android_setup
check_ios_setup

# Build Customer App
if [ "$BUILD_TARGET" == "all" ] || [ "$BUILD_TARGET" == "customer" ] || [ "$BUILD_TARGET" == "android" ]; then
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}CUSTOMER APP${NC}"
    echo -e "${BLUE}============================================${NC}"
    
    CUSTOMER_DIR="$PROJECT_ROOT/apps/WarmpawzCustomer"
    install_npm_deps "$CUSTOMER_DIR"
    
    if [ "$BUILD_TARGET" != "ios" ]; then
        build_android "$CUSTOMER_DIR" "warmpawz-customer"
    fi
fi

# Build Vendor App
if [ "$BUILD_TARGET" == "all" ] || [ "$BUILD_TARGET" == "vendor" ] || [ "$BUILD_TARGET" == "android" ]; then
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}VENDOR APP${NC}"
    echo -e "${BLUE}============================================${NC}"
    
    VENDOR_DIR="$PROJECT_ROOT/apps/WarmpawzVendor"
    install_npm_deps "$VENDOR_DIR"
    
    if [ "$BUILD_TARGET" != "ios" ]; then
        build_android "$VENDOR_DIR" "warmpawz-vendor"
    fi
fi

# iOS builds
if [ "$BUILD_TARGET" == "all" ] || [ "$BUILD_TARGET" == "ios" ]; then
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}IOS BUILDS${NC}"
    echo -e "${BLUE}============================================${NC}"
    
    if [ "$BUILD_TARGET" == "all" ] || [ "$BUILD_TARGET" == "ios" ] || [ "$BUILD_TARGET" == "customer" ]; then
        CUSTOMER_DIR="$PROJECT_ROOT/apps/WarmpawzCustomer"
        build_ios "$CUSTOMER_DIR" "WarmpawzCustomer"
    fi
    
    if [ "$BUILD_TARGET" == "all" ] || [ "$BUILD_TARGET" == "ios" ] || [ "$BUILD_TARGET" == "vendor" ]; then
        VENDOR_DIR="$PROJECT_ROOT/apps/WarmpawzVendor"
        build_ios "$VENDOR_DIR" "WarmpawzVendor"
    fi
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}BUILD COMPLETE${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

if [ -d "$PROJECT_ROOT/build-output/android" ]; then
    echo "Android APKs:"
    ls -la "$PROJECT_ROOT/build-output/android/"
fi

echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Test APKs on physical devices"
echo "2. Upload to Google Play Console / App Store Connect"
echo "3. Run: ./scripts/deploy-cdk.sh to deploy backend"

