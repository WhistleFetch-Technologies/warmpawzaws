#!/bin/bash

# Test App Script
# Quick script to test the design implementation

echo "=== WarmPawz Vendor App - Test Script ==="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this from apps/WarmpawzVendor directory"
    exit 1
fi

echo "✅ Found package.json"
echo ""

# Check Metro bundler
METRO_RUNNING=$(ps aux | grep -i "react-native start" | grep -v grep | wc -l | tr -d ' ')

if [ "$METRO_RUNNING" -eq "0" ]; then
    echo "⚠️  Metro bundler not running"
    echo "   Starting Metro in background..."
    npm start > /dev/null 2>&1 &
    sleep 3
    echo "✅ Metro bundler started"
else
    echo "✅ Metro bundler is running"
fi

echo ""
echo "=== Choose Platform ==="
echo ""
echo "1. Android (Recommended - Easier)"
echo "2. iOS (Requires CocoaPods setup)"
echo ""
read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Starting Android app..."
        echo ""
        npm run android
        ;;
    2)
        echo ""
        echo "🍎 iOS Setup Required"
        echo ""
        
        # Check if CocoaPods is installed
        if ! command -v pod &> /dev/null; then
            echo "❌ CocoaPods not found"
            echo ""
            echo "Please install CocoaPods first:"
            echo "  sudo gem install cocoapods"
            echo ""
            echo "Then run:"
            echo "  cd ios && pod install && cd .."
            echo "  npm run ios"
            exit 1
        fi
        
        # Check if pods are installed
        if [ ! -d "ios/Pods" ]; then
            echo "⚠️  Pods not installed"
            echo "   Installing pods..."
            cd ios
            pod install
            cd ..
        fi
        
        echo "🚀 Starting iOS app..."
        echo ""
        npm run ios
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "=== Testing Checklist ==="
echo ""
echo "When app opens, verify:"
echo "  ✅ Orange gradient on sign-in screen"
echo "  ✅ Logo appears with animation"
echo "  ✅ White card slides up"
echo "  ✅ Status icons (not emojis)"
echo "  ✅ No crashes"
echo ""
echo "See TEST_NOW.md for detailed checklist"

