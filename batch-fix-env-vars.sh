#!/bin/bash

# Batch fix environment variables in vendor components
# This script replaces process.env.NEXT_PUBLIC_API_GATEWAY_URL with the utility function

echo "🔧 Batch fixing environment variables..."

FILES=$(find Warmpawzecodev/src/components/vendor -name "*.tsx" -type f -exec grep -l "process\.env\.NEXT_PUBLIC_API_GATEWAY_URL" {} \;)

for file in $FILES; do
  echo "Processing: $file"
  
  # Calculate relative path for import (assuming files are in src/components/vendor or subdirectories)
  # Count depth: vendor/ = 1, vendor/subdir/ = 2, etc.
  depth=$(echo "$file" | sed 's|[^/]||g' | wc -c)
  depth=$((depth - 4)) # Subtract src/components/vendor
  
  # Build relative path
  if [ $depth -eq 1 ]; then
    import_path="../../utils/api-gateway-url"
  elif [ $depth -eq 2 ]; then
    import_path="../../../utils/api-gateway-url"
  elif [ $depth -eq 3 ]; then
    import_path="../../../../utils/api-gateway-url"
  else
    import_path="../../utils/api-gateway-url" # Default
  fi
  
  # Replace pattern 1: const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
  # With: const { getApiBaseUrl } = await import('../../utils/api-gateway-url'); const API_BASE = getApiBaseUrl();
  
  # Use perl for more reliable multi-line replacement
  perl -i -pe "
    if (/const API_GATEWAY_URL = process\.env\.NEXT_PUBLIC_API_GATEWAY_URL/) {
      \$_ = \"      const { getApiBaseUrl } = await import('$import_path');\\n      const API_BASE = getApiBaseUrl();\\n\";
    }
    s/\$\{API_GATEWAY_URL\}\/make-server-3dd53475/\${API_BASE}/g;
    s/\`\$\{API_GATEWAY_URL\}\/make-server-3dd53475/\`\${API_BASE}/g;
  " "$file"
  
done

echo "✅ Done! Please review changes."

