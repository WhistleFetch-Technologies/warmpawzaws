#!/bin/bash

# ============================================================================
# ANDROID SDK SETUP SCRIPT
# ============================================================================
# Creates local.properties files for Android projects
# Date: 2026-01-02
# ============================================================================

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Android SDK Setup Script${NC}"
echo ""

# Function to find Android SDK
find_android_sdk() {
    # Check common locations
    if [ -d "$HOME/Library/Android/sdk" ]; then
        echo "$HOME/Library/Android/sdk"
    elif [ -d "$HOME/Android/Sdk" ]; then
        echo "$HOME/Android/Sdk"
    elif [ -d "$HOME/.android/sdk" ]; then
        echo "$HOME/.android/sdk"
    elif [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME" ]; then
        echo "$ANDROID_HOME"
    else
        echo ""
    fi
}

# Find Android SDK
SDK_PATH=$(find_android_sdk)

if [ -z "$SDK_PATH" ]; then
    echo -e "${YELLOW}⚠️  Android SDK not found in common locations${NC}"
    echo ""
    echo "Please provide Android SDK path:"
    echo "  1. If using Android Studio (macOS): ~/Library/Android/sdk"
    echo "  2. If using standalone SDK: ~/Android/Sdk"
    echo "  3. Or set ANDROID_HOME environment variable"
    echo ""
    read -p "Enter Android SDK path (or press Enter to use default): " USER_SDK_PATH
    
    if [ -n "$USER_SDK_PATH" ]; then
        SDK_PATH="$USER_SDK_PATH"
    else
        # Use default macOS location
        SDK_PATH="$HOME/Library/Android/sdk"
        echo -e "${YELLOW}Using default path: $SDK_PATH${NC}"
    fi
fi

# Verify SDK path exists
if [ ! -d "$SDK_PATH" ]; then
    echo -e "${RED}❌ Error: SDK path does not exist: $SDK_PATH${NC}"
    echo ""
    echo "Please:"
    echo "  1. Install Android Studio from https://developer.android.com/studio"
    echo "  2. Or install standalone SDK"
    echo "  3. Then run this script again"
    exit 1
fi

echo -e "${GREEN}✅ Found Android SDK at: $SDK_PATH${NC}"
echo ""

# Verify required SDK components
echo "Checking required SDK components..."

MISSING_COMPONENTS=()

if [ ! -d "$SDK_PATH/platforms/android-34" ] && [ ! -d "$SDK_PATH/platforms/android-33" ]; then
    MISSING_COMPONENTS+=("Android Platform (API 34 or 33)")
fi

if [ ! -d "$SDK_PATH/build-tools/34.0.0" ] && [ ! -d "$SDK_PATH/build-tools" ]; then
    MISSING_COMPONENTS+=("Build Tools 34.0.0")
fi

if [ ! -f "$SDK_PATH/platform-tools/adb" ]; then
    MISSING_COMPONENTS+=("Platform Tools")
fi

if [ ${#MISSING_COMPONENTS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Missing SDK components:${NC}"
    for component in "${MISSING_COMPONENTS[@]}"; do
        echo "  - $component"
    done
    echo ""
    echo "Install via Android Studio:"
    echo "  Tools → SDK Manager → Install missing components"
    echo ""
    echo "Or via command line:"
    echo "  sdkmanager \"platforms;android-34\""
    echo "  sdkmanager \"build-tools;34.0.0\""
    echo "  sdkmanager \"platform-tools\""
    echo ""
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ All required SDK components found${NC}"
fi

echo ""

# Get project root directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Create local.properties files
CUSTOMER_PROPS="$PROJECT_ROOT/apps/WarmpawzCustomer/android/local.properties"
VENDOR_PROPS="$PROJECT_ROOT/apps/WarmpawzVendor/android/local.properties"

echo "Creating local.properties files..."

# Customer app
mkdir -p "$(dirname "$CUSTOMER_PROPS")"
echo "sdk.dir=$SDK_PATH" > "$CUSTOMER_PROPS"
echo -e "${GREEN}✅ Created: $CUSTOMER_PROPS${NC}"

# Vendor app
mkdir -p "$(dirname "$VENDOR_PROPS")"
echo "sdk.dir=$SDK_PATH" > "$VENDOR_PROPS"
echo -e "${GREEN}✅ Created: $VENDOR_PROPS${NC}"

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Verify setup:"
echo "     cat $CUSTOMER_PROPS"
echo "     cat $VENDOR_PROPS"
echo ""
echo "  2. Test Customer app build:"
echo "     cd apps/WarmpawzCustomer/android"
echo "     ./gradlew assembleDevRelease"
echo ""
echo "  3. Test Vendor app build:"
echo "     cd apps/WarmpawzVendor/android"
echo "     ./gradlew assembleDevRelease"
echo ""
