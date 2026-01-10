#!/bin/bash
# Fix fetch() calls that were incorrectly modified by the apiClient script
# These should use response.ok and response.json(), not data

VENDOR_DIR="/Users/ketan/Documents/warmpawzecodev/apps/vendor-web/components/vendor"

echo "🔧 Fixing fetch() calls that were incorrectly modified..."

find "$VENDOR_DIR" -name "*.tsx" -type f | while read file; do
    # Check if file has fetch() calls with data references
    if grep -q "await fetch" "$file" && grep -q "if (data && data.success)" "$file"; then
        echo "📝 Fixing: $(basename "$file")"
        
        # Fix pattern: if (data && data.success) after fetch() call
        # Replace with: if (response.ok) { const data = await response.json(); }
        perl -i -0777 -pe 's/const response = await fetch\([^)]+\);\s+if \(data && data\.success\)/const response = await fetch($1);\n      if (response.ok) {\n        const data = await response.json();/gs' "$file"
        
        # Fix standalone: if (data && data.success) after fetch
        perl -i -0777 -pe 's/\);\s+if \(data && data\.success\) \{/);\n      if (response.ok) {\n        const data = await response.json();/gs' "$file"
        
        # Fix: // data already available comments
        sed -i '' 's|// data already available||g' "$file"
        
        # Fix: const error = response; should be const error = await response.json()
        sed -i '' 's/const error = response;/const error = await response.json().catch(() => ({ error: "Unknown error" }));/g' "$file"
        
        echo "  ✅ Fixed: $(basename "$file")"
    fi
done

echo "✨ Done!"

