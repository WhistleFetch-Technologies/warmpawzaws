#!/bin/bash

# Fix import paths system-wide
# This script fixes incorrect relative import paths in components

echo "🔧 Fixing import paths system-wide..."

# Function to calculate correct path from component to utils
fix_import_path() {
    local file_path="$1"
    local depth=$(echo "$file_path" | grep -o "/" | wc -l | tr -d ' ')
    
    # Calculate how many levels up we need to go
    # src/components/customer/file.tsx -> ../../utils (2 levels)
    # src/components/customer/grooming/file.tsx -> ../../../utils (3 levels)
    # src/components/vendor/file.tsx -> ../../utils (2 levels)
    # src/components/admin/file.tsx -> ../../utils (2 levels)
    
    # Count directory depth from src/
    # src/components = 2, so we need to go up (depth - 1) levels
    local levels_up=$((depth - 1))
    
    # Build the correct path
    local correct_path=""
    for ((i=0; i<levels_up; i++)); do
        correct_path="../$correct_path"
    done
    correct_path="${correct_path}utils"
    
    echo "$correct_path"
}

# Fix utils/supabase/info imports
echo "📝 Fixing utils/supabase/info imports..."

# Files directly in customer/, vendor/, admin/ should use ../../utils
find src/components/customer -maxdepth 1 -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "from ['\"]\.\.\/\.\.\/\.\.\/utils\/supabase\/info" "$file" 2>/dev/null; then
        echo "Fixing: $file"
        sed -i '' "s|from ['\"]\.\.\/\.\.\/\.\.\/utils\/supabase\/info|from '../../utils/supabase/info|g" "$file"
        sed -i '' "s|from ['\"]\.\.\/\.\.\/\.\.\/utils\/|from '../../utils/|g" "$file"
    fi
done

# Files in subdirectories (customer/grooming/, customer/vet/, etc.) should use ../../../utils
find src/components/customer -mindepth 2 -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "from ['\"]\.\.\/\.\.\/\.\.\/utils\/supabase\/info" "$file" 2>/dev/null; then
        # This is correct for subdirectories, but let's verify
        echo "Checking subdirectory: $file"
    fi
done

# Fix vendor/ files
find src/components/vendor -maxdepth 1 -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "from ['\"]\.\.\/\.\.\/\.\.\/utils\/supabase\/info" "$file" 2>/dev/null; then
        echo "Fixing: $file"
        sed -i '' "s|from ['\"]\.\.\/\.\.\/\.\.\/utils\/supabase\/info|from '../../utils/supabase/info|g" "$file"
        sed -i '' "s|from ['\"]\.\.\/\.\.\/\.\.\/utils\/|from '../../utils/|g" "$file"
    fi
done

# Fix admin/ files
find src/components/admin -maxdepth 1 -name "*.tsx" -o -name "*.ts" | while read file; do
    if grep -q "from ['\"]\.\.\/\.\.\/\.\.\/utils\/supabase\/info" "$file" 2>/dev/null; then
        echo "Fixing: $file"
        sed -i '' "s|from ['\"]\.\.\/\.\.\/\.\.\/utils\/supabase\/info|from '../../utils/supabase/info|g" "$file"
        sed -i '' "s|from ['\"]\.\.\/\.\.\/\.\.\/utils\/|from '../../utils/|g" "$file"
    fi
done

echo "✅ Import path fixes complete!"

