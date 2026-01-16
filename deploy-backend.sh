#!/bin/bash

# Deploy Backend to Supabase
# Loads SUPABASE_ACCESS_TOKEN from .env file and deploys

set -e

echo "🚀 Deploying Backend to Supabase..."
echo "===================================="
echo ""

# Load environment variables from .env file
if [ -f ".env" ]; then
    echo "📦 Loading environment variables from .env file..."
    # Export variables from .env (skip comments and empty lines)
    export $(grep -v '^#' .env | grep -v '^$' | xargs)
    echo "✅ Environment variables loaded"
else
    echo "⚠️  .env file not found"
    if [ -f ".env.example" ]; then
        echo "   Found .env.example - copying to .env..."
        cp .env.example .env
        echo "   ✅ Created .env file from .env.example"
        echo "   ⚠️  Please edit .env file and add your actual credentials"
        exit 1
    else
        echo "   Please create .env file with your credentials"
        echo "   See .env.example for required variables"
        exit 1
    fi
fi

# Check for Supabase CLI
if ! command -v supabase &> /dev/null && ! npx supabase --version &> /dev/null 2>&1; then
    echo "❌ Supabase CLI not found."
    echo "   Installing via npx..."
    npm install -g supabase
fi

# Use npx if supabase command is not available
if command -v supabase &> /dev/null; then
    SUPABASE_CMD="supabase"
else
    SUPABASE_CMD="npx supabase"
fi

# Check for access token
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "❌ SUPABASE_ACCESS_TOKEN not found in .env file"
    echo ""
    echo "   Please add SUPABASE_ACCESS_TOKEN to your .env file:"
    echo "   1. Get your token from: https://supabase.com/dashboard/account/tokens"
    echo "   2. Add to .env: SUPABASE_ACCESS_TOKEN=your_token_here"
    exit 1
fi

# Export token for Supabase CLI
export SUPABASE_ACCESS_TOKEN

# Check if project is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "⚠️  Project not linked. Linking now..."
    $SUPABASE_CMD link --project-ref vpvpbdwtyugbknrntkho
fi

# Ensure function directory exists
FUNCTION_NAME="make-server-3dd53475"
FUNCTION_DIR="supabase/functions/${FUNCTION_NAME}"

if [ ! -d "$FUNCTION_DIR" ]; then
    echo "📦 Function directory not found. Checking for source files..."
    if [ -d "src/supabase/functions/server" ]; then
        echo "   Copying from src/supabase/functions/server..."
        mkdir -p "$FUNCTION_DIR"
        cp -r src/supabase/functions/server/* "$FUNCTION_DIR/"
    else
        echo "   ✅ Function directory already exists at correct location"
    fi
fi

# Verify main entry point exists
if [ ! -f "${FUNCTION_DIR}/index.tsx" ]; then
    echo "❌ Error: index.tsx not found in ${FUNCTION_DIR}"
    exit 1
fi

# Deploy the function
echo ""
echo "🚀 Deploying function: ${FUNCTION_NAME}..."
echo "   Using access token: ${SUPABASE_ACCESS_TOKEN:0:20}..."
echo ""

$SUPABASE_CMD functions deploy "${FUNCTION_NAME}" --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ✅ ✅ BACKEND DEPLOYMENT SUCCESSFUL! ✅ ✅ ✅"
    echo ""
    echo "📝 Function URL:"
    echo "   https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/${FUNCTION_NAME}"
    echo ""
    echo "🧪 Test health endpoint:"
    echo "   curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/${FUNCTION_NAME}/health"
    echo ""
    echo "📊 View logs:"
    echo "   $SUPABASE_CMD functions logs ${FUNCTION_NAME}"
    echo ""
else
    echo ""
    echo "❌ Deployment failed. Please check the error messages above."
    exit 1
fi
