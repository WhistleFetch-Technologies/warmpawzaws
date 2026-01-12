#!/bin/bash
# Extract all API endpoints from Admin UI pages

echo "=== ADMIN UI ENDPOINTS AUDIT ==="
echo ""

cd "$(dirname "$0")/.."

echo "Scanning all Admin UI pages for API calls..."
echo ""

# Find all API calls
find apps/admin-web/app -name "*.tsx" -type f | while read file; do
    echo "=== $(basename $(dirname $file))/$(basename $file) ==="
    grep -o "apiClient\.\(get\|post\|put\|delete\|patch\)(['\"][^'\"]*['\"])" "$file" | \
        sed 's/apiClient\.\(get\|post\|put\|delete\|patch\)(//g' | \
        sed "s/['\"]//g" | \
        sort -u | \
        sed 's/^/  /'
    echo ""
done

echo ""
echo "=== SUMMARY ==="
echo "Total unique endpoints found:"
find apps/admin-web/app -name "*.tsx" -type f -exec grep -ho "apiClient\.\(get\|post\|put\|delete\|patch\)(['\"][^'\"]*['\"])" {} \; | \
    sed 's/apiClient\.\(get\|post\|put\|delete\|patch\)(//g' | \
    sed "s/['\"]//g" | \
    sort -u | wc -l
