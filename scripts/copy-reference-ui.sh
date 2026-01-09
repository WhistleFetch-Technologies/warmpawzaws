#!/bin/bash
# Script to copy all UI components from reference folder to target apps
# AWS Serverless compatible - uses environment variables

REFERENCE_DIR="/Users/ketan/Documents/Warmpawz Ecosystem Development"
TARGET_CUSTOMER_DIR="/Users/ketan/Documents/warmpawzecodev/apps/customer-web/components/customer"
TARGET_VENDOR_DIR="/Users/ketan/Documents/warmpawzecodev/apps/vendor-web/components/vendor"

echo "Starting UI component copy from reference..."
echo "Reference: $REFERENCE_DIR"
echo "Target Customer: $TARGET_CUSTOMER_DIR"
echo "Target Vendor: $TARGET_VENDOR_DIR"

# Function to adapt imports in a file
adapt_imports() {
    local file="$1"
    # Adapt imports: ../ui/ -> @/components/ui/
    sed -i '' 's|from '\''\.\./ui/|from '\''@/components/ui/|g' "$file"
    sed -i '' 's|from "\.\./ui/|from "@/components/ui/|g' "$file"
    # Adapt imports: ../../context/ -> @/context/
    sed -i '' 's|from '\''\.\./\.\./context/|from '\''@/context/|g' "$file"
    sed -i '' 's|from "\.\./\.\./context/|from "@/context/|g' "$file"
    # Adapt imports: ../../utils/ -> @/lib/
    sed -i '' 's|from '\''\.\./\.\./utils/|from '\''@/lib/|g' "$file"
    sed -i '' 's|from "\.\./\.\./utils/|from "@/lib/|g' "$file"
    # Remove figma asset imports
    sed -i '' '/figma:asset/d' "$file"
    # Add 'use client' if not present
    if ! grep -q "'use client'" "$file" && ! grep -q '"use client"' "$file"; then
        sed -i '' '1i\
'\''use client'\'';
' "$file"
    fi
}

# Copy customer components
echo "Copying customer components..."
find "$REFERENCE_DIR/src/components/customer" -name "*.tsx" -type f | while read ref_file; do
    filename=$(basename "$ref_file")
    target_file="$TARGET_CUSTOMER_DIR/$filename"
    
    echo "Copying: $filename"
    cp "$ref_file" "$target_file"
    adapt_imports "$target_file"
done

# Copy vendor components
echo "Copying vendor components..."
if [ -d "$REFERENCE_DIR/src/components/vendor" ]; then
    find "$REFERENCE_DIR/src/components/vendor" -name "*.tsx" -type f | while read ref_file; do
        filename=$(basename "$ref_file")
        target_file="$TARGET_VENDOR_DIR/$filename"
        
        echo "Copying: $filename"
        cp "$ref_file" "$target_file"
        adapt_imports "$target_file"
    done
fi

echo "UI component copy complete!"

