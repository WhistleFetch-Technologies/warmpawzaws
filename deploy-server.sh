#!/bin/bash

# Deploy Supabase Edge Function Server
# This script deploys the make-server-3dd53475 edge function to Supabase

set -e

echo "🚀 Starting server deployment..."

# Check if Supabase CLI is available (via npx or global)
if ! command -v supabase &> /dev/null && ! npx supabase --version &> /dev/null; then
    echo "❌ Supabase CLI not found."
    echo "   Please install it with: npm install -g supabase"
    echo "   Or use npx: npx supabase --version"
    exit 1
fi

# Use npx if supabase command is not available
if command -v supabase &> /dev/null; then
    SUPABASE_CMD="supabase"
else
    SUPABASE_CMD="npx supabase"
fi

# Check if we're linked to a project
if [ ! -f ".supabase/config.toml" ]; then
    echo "⚠️  Not linked to a Supabase project. Please run:"
    echo "   supabase link --project-ref YOUR_PROJECT_REF"
    echo ""
    echo "Or if you need to initialize:"
    echo "   supabase init"
    exit 1
fi

# Function name
FUNCTION_NAME="make-server-3dd53475"

# Source directory
SOURCE_DIR="src/supabase/functions/server"

# Target directory for Supabase function
TARGET_DIR="supabase/functions/${FUNCTION_NAME}"

echo "📦 Preparing function deployment..."

# Create target directory if it doesn't exist
mkdir -p "${TARGET_DIR}"

# Copy all server files to the function directory
echo "📋 Copying server files..."
cp -r "${SOURCE_DIR}"/* "${TARGET_DIR}/"

# Ensure the main file is named index.tsx
if [ -f "${TARGET_DIR}/index.tsx" ]; then
    echo "✅ Main entry point found: index.tsx"
else
    echo "❌ Error: index.tsx not found in ${SOURCE_DIR}"
    exit 1
fi

# Deploy the function
echo "🚀 Deploying function: ${FUNCTION_NAME}..."
${SUPABASE_CMD} functions deploy "${FUNCTION_NAME}" --no-verify-jwt

if [ $? -eq 0 ]; then
    echo "✅ Server deployed successfully!"
    echo ""
    echo "📝 Function URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/${FUNCTION_NAME}"
    echo ""
    echo "🧪 Test the deployment:"
    echo "   curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/${FUNCTION_NAME}/health"
else
    echo "❌ Deployment failed!"
    exit 1
fi

