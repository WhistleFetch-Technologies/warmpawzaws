#!/bin/bash
echo "🔍 SCANNING ALL FRONTEND APPS FOR API ENDPOINTS"
echo "================================================="
echo ""

OUTPUT_FILE="API_ENDPOINTS_INVENTORY.txt"
> "$OUTPUT_FILE"

echo "Scanning admin-web..."
grep -rh "apiClient\.\(get\|post\|put\|delete\|patch\)" apps/admin-web --include="*.tsx" --include="*.ts" 2>/dev/null | \
  grep -oE "'/[^']*'" | sort -u >> "$OUTPUT_FILE"

echo "Scanning vendor-web..."
grep -rh "apiClient\.\(get\|post\|put\|delete\|patch\)" apps/vendor-web --include="*.tsx" --include="*.ts" 2>/dev/null | \
  grep -oE "'/[^']*'" | sort -u >> "$OUTPUT_FILE"

echo "Scanning customer-web..."
grep -rh "apiClient\.\(get\|post\|put\|delete\|patch\)" apps/customer-web --include="*.tsx" --include="*.ts" 2>/dev/null | \
  grep -oE "'/[^']*'" | sort -u >> "$OUTPUT_FILE"

echo ""
echo "Removing duplicates and sorting..."
sort -u "$OUTPUT_FILE" -o "$OUTPUT_FILE"

echo ""
echo "📊 FOUND $(wc -l < "$OUTPUT_FILE") UNIQUE API ENDPOINTS"
echo ""
echo "Endpoints:"
cat "$OUTPUT_FILE"

echo ""
echo "Full list saved to: $OUTPUT_FILE"
