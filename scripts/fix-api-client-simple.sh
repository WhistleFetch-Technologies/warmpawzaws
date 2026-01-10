#!/bin/bash
# Simple script to fix common apiClient.get() misuse patterns
# Focuses on the most common issues we've identified

VENDOR_DIR="/Users/ketan/Documents/warmpawzecodev/apps/vendor-web/components/vendor"

echo "🔍 Fixing apiClient.get() misuse patterns..."
echo ""

# Find all files with apiClient.get issues
find "$VENDOR_DIR" -name "*.tsx" -type f | while read file; do
    needs_fix=false
    
    # Check if file needs fixing
    if grep -q "apiClient\.get.*)," "$file" || \
       grep -q "response\.ok" "$file" || \
       grep -q "response\.json()" "$file" || \
       grep -q "roleRes\.ok\|availRes\.ok\|vendorRes\.ok" "$file"; then
        needs_fix=true
    fi
    
    if [ "$needs_fix" = true ]; then
        echo "📝 Fixing: $(basename "$file")"
        
        # Create backup
        cp "$file" "$file.backup-$(date +%s)"
        
        # Fix 1: Remove options object from apiClient.get() calls
        # Pattern: apiClient.get('/endpoint'), { headers: ... }
        perl -i -0777 -pe 's/await\s+apiClient\.get\(([^)]+)\)\s*,\s*\n\s*\{[^}]*headers[^}]*\}/await apiClient.get($1) as any/gs' "$file"
        
        # Fix 2: Change response variable names to data
        sed -i '' 's/const response = await apiClient\.get/const data = await apiClient.get/g' "$file"
        sed -i '' 's/const roleRes = await apiClient\.get/const roleData = await apiClient.get/g' "$file"
        sed -i '' 's/const availRes = await apiClient\.get/const availData = await apiClient.get/g' "$file"
        sed -i '' 's/const vendorRes = await apiClient\.get/const vendorData = await apiClient.get/g' "$file"
        sed -i '' 's/const servicesRes = await apiClient\.get/const servicesData = await apiClient.get/g' "$file"
        sed -i '' 's/const statusRes = await apiClient\.get/const statusData = await apiClient.get/g' "$file"
        sed -i '' 's/const facilityRes = await apiClient\.get/const facilityData = await apiClient.get/g' "$file"
        
        # Fix 3: Add 'as any' to apiClient.get() calls that don't have it
        sed -i '' 's/await apiClient\.get(\([^)]*\))$/await apiClient.get(\1) as any/g' "$file"
        sed -i '' 's/await apiClient\.get(\([^)]*\));/await apiClient.get(\1) as any;/g' "$file"
        
        # Fix 4: Replace response.ok with data checks
        sed -i '' 's/if (response\.ok)/if (data \&\& data.success)/g' "$file"
        sed -i '' 's/if (!response\.ok)/if (!data)/g' "$file"
        sed -i '' 's/if (roleRes\.ok)/if (roleData)/g' "$file"
        sed -i '' 's/if (availRes\.ok)/if (availData)/g' "$file"
        sed -i '' 's/if (vendorRes\.ok)/if (vendorData)/g' "$file"
        sed -i '' 's/if (servicesRes\.ok)/if (servicesData)/g' "$file"
        sed -i '' 's/if (statusRes\.ok)/if (statusData)/g' "$file"
        
        # Fix 5: Remove response.json() calls
        perl -i -0777 -pe 's/const\s+data\s*=\s*await\s+response\.json\(\);/\/\/ data already available/g' "$file"
        perl -i -0777 -pe 's/const\s+(\w+)\s*=\s*await\s+(\w+)\.json\(\);/const $1 = $2;/g' "$file"
        
        # Fix 6: Remove response.status references
        sed -i '' 's/response\.status/200/g' "$file"
        sed -i '' 's/response\.statusText/""/g' "$file"
        
        # Fix 7: Fix template literals (single quotes with ${} to backticks)
        sed -i '' "s|'/make-server-3dd53475/\${|\`/make-server-3dd53475/\${|g" "$file"
        sed -i '' "s|'/vendor/\${|\`/vendor/\${|g" "$file"
        sed -i '' "s|'/prescription/\${|\`/prescription/\${|g" "$file"
        
        # Fix 8: Remove else blocks that reference response
        perl -i -0777 -pe 's/\}\s*else\s*\{[^\}]*response\.(ok|status|json)[^\}]*\}//gs' "$file"
        
        echo "  ✅ Fixed: $(basename "$file")"
    fi
done

echo ""
echo "✨ Fix complete!"
echo "⚠️  Please test the build: cd apps/vendor-web && npm run build"

