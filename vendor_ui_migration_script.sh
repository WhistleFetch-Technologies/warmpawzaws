#!/bin/bash

# ============================================================================
# VENDOR UI MIGRATION SCRIPT - React Native to Next.js Web App
# ============================================================================
# This script copies all vendor UI pages from WarmpawzVendor React Native app
# and adapts them for AWS deployment architecture (Cognito, RDS, Lambda, S3, CloudFront)
# ============================================================================

set -e

echo "🚀 Starting Vendor UI Migration from React Native to Next.js Web App"
echo "================================================================="

PROJECT_ROOT="/Users/ketan/Documents/warmpawzecodev"
SOURCE_DIR="$PROJECT_ROOT/apps/WarmpawzVendor/src"
TARGET_DIR="$PROJECT_ROOT/apps/vendor-web"
COMPONENTS_DIR="$TARGET_DIR/components/vendor"

echo "📁 Source: $SOURCE_DIR/screens"
echo "📁 Target: $COMPONENTS_DIR"
echo ""

# Function to convert React Native component to React/Next.js component
convert_component() {
    local source_file="$1"
    local target_file="$2"
    local component_name="$3"

    echo "🔄 Converting $component_name..."

    # Create target directory if it doesn't exist
    mkdir -p "$(dirname "$target_file")"

    # Copy source file and apply basic transformations
    cp "$source_file" "$target_file"

    # Add 'use client' directive at the top
    sed -i '1i use client' "$target_file"

    # Replace React Native imports with React imports
    sed -i "s/from 'react-native'/from 'react'/g" "$target_file"
    sed -i "s/import { VendorApi } from '..\/..\/services\/api'/import { apiClient } from '@\/lib\/api-client'/g" "$target_file"
    sed -i 's/VendorApi\./apiClient./g' "$target_file"

    # Replace navigation calls
    sed -i 's/navigation\.navigate/onNavigate/g' "$target_file"
    sed -i 's/navigation\.goBack/onBack/g' "$target_file"

    # Update component interface name
    sed -i "s/interface.*Props {/interface ${component_name}Props {/g" "$target_file"
    sed -i "s/function.*({/export function ${component_name}({/g" "$target_file"
    sed -i "s/}:.*Props)/}: ${component_name}Props)/g" "$target_file"

    # Basic tag conversions (more comprehensive conversion will be done manually)
    sed -i 's/<SafeAreaView /<div /g' "$target_file"
    sed -i 's/<\/SafeAreaView>/<\/div>/g' "$target_file"
    sed -i 's/<ScrollView /<div /g' "$target_file"
    sed -i 's/<\/ScrollView>/<\/div>/g' "$target_file"
    sed -i 's/<View /<div /g' "$target_file"
    sed -i 's/<\/View>/<\/div>/g' "$target_file"
    sed -i 's/<Text /<span /g' "$target_file"
    sed -i 's/<\/Text>/<\/span>/g' "$target_file"
    sed -i 's/<TouchableOpacity /<button /g' "$target_file"
    sed -i 's/<\/TouchableOpacity>/<\/button>/g' "$target_file"

    # Update style references to className
    sed -i 's/style={/className={/g' "$target_file"

    # Add component-specific logging
    sed -i "s/console\.log(/console.log(\`[${component_name}] \` + /g" "$target_file"

    echo "✅ Converted $component_name to $target_file"
}

# Function to copy and adapt screen components
copy_screen() {
    local screen_dir="$1"
    local screen_name="$2"

    echo "📋 Processing $screen_name screens..."

    # Find all screen files (excluding backups)
    find "$SOURCE_DIR/screens/$screen_dir" -name "*.tsx" -not -name "*.backup" | while read -r source_file; do
        # Extract filename without extension
        filename=$(basename "$source_file" .tsx)

        # Create target file path
        target_file="$COMPONENTS_DIR/$screen_name/${filename}.tsx"

        # Convert component name (remove Screen suffix, add proper casing)
        component_name=$(echo "$filename" | sed 's/Screen$//' | sed 's/\b\w/\U&/g')

        # Convert the component
        convert_component "$source_file" "$target_file" "$component_name"
    done
}

# Create necessary directories
echo "📁 Creating target directories..."
mkdir -p "$COMPONENTS_DIR/dashboard"
mkdir -p "$COMPONENTS_DIR/bookings"
mkdir -p "$COMPONENTS_DIR/analytics"
mkdir -p "$COMPONENTS_DIR/earnings"
mkdir -p "$COMPONENTS_DIR/profile"
mkdir -p "$COMPONENTS_DIR/settings"
mkdir -p "$COMPONENTS_DIR/staff"
mkdir -p "$COMPONENTS_DIR/services"
mkdir -p "$COMPONENTS_DIR/auth"
mkdir -p "$COMPONENTS_DIR/onboarding"

# Copy and convert all screen categories
echo "🎯 Starting screen conversion..."

# Dashboard screens
copy_screen "dashboard" "dashboard"

# Booking screens
copy_screen "bookings" "bookings"

# Analytics screens
copy_screen "analytics" "analytics"

# Earnings screens
copy_screen "earnings" "earnings"

# Profile screens
copy_screen "profile" "profile"

# Settings screens
copy_screen "settings" "settings"

# Staff screens
copy_screen "staff" "staff"

# Services screens
copy_screen "services" "services"

# Auth screens
copy_screen "auth" "auth"

# Onboarding screens
copy_screen "onboarding" "onboarding"

echo ""
echo "🎉 Vendor UI Migration Complete!"
echo "=================================="
echo "✅ Copied and converted $(find "$SOURCE_DIR/screens" -name "*.tsx" -not -name "*.backup" | wc -l) vendor UI screens"
echo ""
echo "📝 Next Steps:"
echo "1. Review and fix any conversion issues in the generated components"
echo "2. Update navigation handlers to use Next.js routing"
echo "3. Replace StyleSheet styles with Tailwind CSS classes"
echo "4. Test each component with AWS Lambda endpoints"
echo "5. Update VendorLandingPage to include new navigation routes"
echo ""
echo "🔧 Components generated in: $COMPONENTS_DIR"
echo "🗂️  Check the components for any remaining React Native specific code"