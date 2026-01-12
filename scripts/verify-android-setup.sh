#!/bin/bash

# ============================================================================
# ANDROID SETUP VERIFICATION SCRIPT
# ============================================================================
# Verifies Android SDK setup and provides setup instructions
# Date: 2026-01-02
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Android Setup Verification${NC}"
echo ""

# Check ANDROID_HOME
echo "Checking ANDROID_HOME environment variable..."
if [ -n "$ANDROID_HOME" ]; then
    echo -e "${GREEN}✅ ANDROID_HOME is set: $ANDROID_HOME${NC}"
    if [ -d "$ANDROID_HOME" ]; then
        echo -e "${GREEN}✅ SDK directory exists${NC}"
    else
        echo -e "${RED}❌ SDK directory does not exist: $ANDROID_HOME${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  ANDROID_HOME is not set${NC}"
    echo "   Set it in ~/.zshrc or ~/.bash_profile:"
    echo "   export ANDROID_HOME=\$HOME/Library/Android/sdk"
fi
echo ""

# Check common SDK locations
echo "Checking common Android SDK locations..."
SDK_FOUND=false

if [ -d "$HOME/Library/Android/sdk" ]; then
    echo -e "${GREEN}✅ Found SDK at: $HOME/Library/Android/sdk${NC}"
    SDK_FOUND=true
    SUGGESTED_SDK="$HOME/Library/Android/sdk"
elif [ -d "$HOME/Android/Sdk" ]; then
    echo -e "${GREEN}✅ Found SDK at: $HOME/Android/Sdk${NC}"
    SDK_FOUND=true
    SUGGESTED_SDK="$HOME/Android/Sdk"
elif [ -d "$HOME/.android/sdk" ]; then
    echo -e "${GREEN}✅ Found SDK at: $HOME/.android/sdk${NC}"
    SDK_FOUND=true
    SUGGESTED_SDK="$HOME/.android/sdk"
else
    echo -e "${YELLOW}⚠️  Android SDK not found in common locations${NC}"
fi
echo ""

# Check local.properties files
echo "Checking local.properties files..."

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

CUSTOMER_PROPS="$PROJECT_ROOT/apps/WarmpawzCustomer/android/local.properties"
VENDOR_PROPS="$PROJECT_ROOT/apps/WarmpawzVendor/android/local.properties"

if [ -f "$CUSTOMER_PROPS" ]; then
    echo -e "${GREEN}✅ Customer app local.properties exists${NC}"
    CUSTOMER_SDK=$(grep "sdk.dir=" "$CUSTOMER_PROPS" | cut -d'=' -f2)
    echo "   SDK path: $CUSTOMER_SDK"
    if [ -d "$CUSTOMER_SDK" ]; then
        echo -e "${GREEN}   ✅ SDK directory exists${NC}"
    else
        echo -e "${RED}   ❌ SDK directory does not exist${NC}"
    fi
else
    echo -e "${RED}❌ Customer app local.properties missing${NC}"
fi

if [ -f "$VENDOR_PROPS" ]; then
    echo -e "${GREEN}✅ Vendor app local.properties exists${NC}"
    VENDOR_SDK=$(grep "sdk.dir=" "$VENDOR_PROPS" | cut -d'=' -f2)
    echo "   SDK path: $VENDOR_SDK"
    if [ -d "$VENDOR_SDK" ]; then
        echo -e "${GREEN}   ✅ SDK directory exists${NC}"
    else
        echo -e "${RED}   ❌ SDK directory does not exist${NC}"
    fi
else
    echo -e "${RED}❌ Vendor app local.properties missing${NC}"
fi
echo ""

# Check SDK components
if [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME" ]; then
    echo "Checking SDK components..."
    
    if [ -d "$ANDROID_HOME/platforms/android-34" ] || [ -d "$ANDROID_HOME/platforms/android-33" ]; then
        echo -e "${GREEN}✅ Android Platform installed${NC}"
    else
        echo -e "${YELLOW}⚠️  Android Platform not found${NC}"
        echo "   Install: sdkmanager \"platforms;android-34\""
    fi
    
    if [ -d "$ANDROID_HOME/build-tools/34.0.0" ] || [ -d "$ANDROID_HOME/build-tools" ]; then
        echo -e "${GREEN}✅ Build Tools installed${NC}"
    else
        echo -e "${YELLOW}⚠️  Build Tools not found${NC}"
        echo "   Install: sdkmanager \"build-tools;34.0.0\""
    fi
    
    if [ -f "$ANDROID_HOME/platform-tools/adb" ]; then
        echo -e "${GREEN}✅ Platform Tools installed${NC}"
        ADB_VERSION=$("$ANDROID_HOME/platform-tools/adb" version 2>/dev/null | head -1 || echo "unknown")
        echo "   Version: $ADB_VERSION"
    else
        echo -e "${YELLOW}⚠️  Platform Tools not found${NC}"
        echo "   Install: sdkmanager \"platform-tools\""
    fi
    echo ""
fi

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Setup Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$SDK_FOUND" = true ] && [ -f "$CUSTOMER_PROPS" ] && [ -f "$VENDOR_PROPS" ]; then
    echo -e "${GREEN}✅ Setup looks good!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Test Customer app build:"
    echo "     cd apps/WarmpawzCustomer/android && ./gradlew assembleDevRelease"
    echo ""
    echo "  2. Test Vendor app build:"
    echo "     cd apps/WarmpawzVendor/android && ./gradlew assembleDevRelease"
else
    echo -e "${YELLOW}⚠️  Setup incomplete${NC}"
    echo ""
    echo "Required actions:"
    
    if [ "$SDK_FOUND" = false ]; then
        echo "  1. Install Android SDK:"
        echo "     - Download Android Studio: https://developer.android.com/studio"
        echo "     - Or install via: brew install --cask android-studio"
    fi
    
    if [ ! -f "$CUSTOMER_PROPS" ] || [ ! -f "$VENDOR_PROPS" ]; then
        echo "  2. Create local.properties files:"
        if [ "$SDK_FOUND" = true ]; then
            echo "     ./scripts/setup-android-sdk.sh"
        else
            echo "     After installing SDK, run: ./scripts/setup-android-sdk.sh"
        fi
    fi
    
    if [ -z "$ANDROID_HOME" ]; then
        echo "  3. Set ANDROID_HOME environment variable:"
        if [ "$SDK_FOUND" = true ]; then
            echo "     Add to ~/.zshrc:"
            echo "     export ANDROID_HOME=$SUGGESTED_SDK"
        else
            echo "     export ANDROID_HOME=\$HOME/Library/Android/sdk"
        fi
    fi
fi

echo ""
