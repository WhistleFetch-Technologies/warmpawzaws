#!/bin/bash

# Script to fix environment variable access for Vite compatibility
# Replaces process.env.NEXT_PUBLIC_API_GATEWAY_URL with utility function

echo "🔧 Fixing environment variable access for Vite compatibility..."

# Find all files with process.env.NEXT_PUBLIC_API_GATEWAY_URL
FILES=$(find Warmpawzecodev/src/components/vendor -name "*.tsx" -type f -exec grep -l "process\.env\.NEXT_PUBLIC_API_GATEWAY_URL" {} \;)

for file in $FILES; do
  echo "Processing: $file"
  
  # Replace direct process.env usage with utility function
  # Pattern 1: const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
  sed -i '' 's/const API_GATEWAY_URL = process\.env\.NEXT_PUBLIC_API_GATEWAY_URL || '\'''\'';/const { getApiBaseUrl } = await import('\''..\/..\/utils\/api-gateway-url'\'');\n      const API_BASE = getApiBaseUrl();/g' "$file"
  
  # Pattern 2: process.env.NEXT_PUBLIC_API_GATEWAY_URL || ''
  sed -i '' 's/process\.env\.NEXT_PUBLIC_API_GATEWAY_URL || '\'''\''/getApiBaseUrl()/g' "$file"
  
  # Pattern 3: ${API_GATEWAY_URL}/make-server-3dd53475 -> ${API_BASE}
  sed -i '' 's/\${API_GATEWAY_URL}\/make-server-3dd53475/\${API_BASE}/g' "$file"
  sed -i '' 's/\`\${API_GATEWAY_URL}\/make-server-3dd53475/\`\${API_BASE}/g' "$file"
  
done

echo "✅ Done! Please review changes manually."

