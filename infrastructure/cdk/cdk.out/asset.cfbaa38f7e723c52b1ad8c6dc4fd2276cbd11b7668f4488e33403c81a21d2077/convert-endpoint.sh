#!/bin/bash
# Endpoint Conversion Script
# Converts Deno endpoint files to Node.js-compatible versions

SOURCE_DIR="../../supabase/functions/make-server-3dd53475"
TARGET_DIR="src/endpoints"

if [ -z "$1" ]; then
  echo "Usage: ./convert-endpoint.sh <endpoint-file.tsx>"
  echo "Example: ./convert-endpoint.sh auth-endpoints.tsx"
  exit 1
fi

ENDPOINT_FILE="$1"
SOURCE_FILE="${SOURCE_DIR}/${ENDPOINT_FILE}"
TARGET_FILE="${TARGET_DIR}/${ENDPOINT_FILE%.tsx}.ts"

if [ ! -f "$SOURCE_FILE" ]; then
  echo "Error: Source file not found: $SOURCE_FILE"
  exit 1
fi

echo "Converting: $ENDPOINT_FILE"
echo "Source: $SOURCE_FILE"
echo "Target: $TARGET_FILE"

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

# Copy file and convert
cp "$SOURCE_FILE" "$TARGET_FILE"

# Convert imports
sed -i '' 's|from '\''npm:hono@4'\''|from '\''hono'\''|g' "$TARGET_FILE"
sed -i '' 's|from "npm:hono@4"|from "hono"|g' "$TARGET_FILE"
sed -i '' 's|from '\''npm:hono'\''|from '\''hono'\''|g' "$TARGET_FILE"
sed -i '' 's|from "npm:hono"|from "hono"|g' "$TARGET_FILE"

# Convert AWS SDK imports (already npm, just remove version)
sed -i '' 's|from '\''npm:@aws-sdk/|from '\''@aws-sdk/|g' "$TARGET_FILE"
sed -i '' 's|from "npm:@aws-sdk/|from "@aws-sdk/|g' "$TARGET_FILE"

# Convert relative imports - adjust paths
# From: ../../lib/  To: ../../../supabase/functions/make-server-3dd53475/lib/
sed -i '' 's|from '\''\.\./\.\./lib/|from '\''../../../supabase/functions/make-server-3dd53475/lib/|g' "$TARGET_FILE"
sed -i '' 's|from "\.\./\.\./lib/|from "../../../supabase/functions/make-server-3dd53475/lib/|g' "$TARGET_FILE"

# From: ./  To: ../../../supabase/functions/make-server-3dd53475/
sed -i '' 's|from '\''\./|from '\''../../../supabase/functions/make-server-3dd53475/|g' "$TARGET_FILE"
sed -i '' 's|from "\./|from "../../../supabase/functions/make-server-3dd53475/|g' "$TARGET_FILE"

# Remove .tsx/.ts extensions from relative imports (Node.js doesn't need them)
sed -i '' 's|\.tsx'\''|'\''|g' "$TARGET_FILE"
sed -i '' 's|\.tsx"|"|g' "$TARGET_FILE"
sed -i '' 's|\.ts'\''|'\''|g' "$TARGET_FILE"
sed -i '' 's|\.ts"|"|g' "$TARGET_FILE"

# Convert Deno.env.get() to process.env
sed -i '' 's|Deno\.env\.get(|process.env.|g' "$TARGET_FILE"

echo "✅ Conversion complete: $TARGET_FILE"
echo "⚠️  Please review and test the converted file"

