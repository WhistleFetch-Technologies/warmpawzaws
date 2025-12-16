#!/bin/bash

# Warmpawz Server Deployment Script
# This script deploys the Supabase Edge Function to production

set -e

echo "🚀 Warmpawz Server Deployment"
echo "=============================="
echo ""

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null && ! npx supabase --version &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing via npx..."
    echo "   (This will be installed temporarily)"
fi

# Project configuration
PROJECT_REF="vpvpbdwtyugbknrntkho"
FUNCTION_NAME="server"

# Step 1: Ensure proper directory structure
echo "📁 Step 1: Setting up directory structure..."
mkdir -p supabase/functions/${FUNCTION_NAME}

# Step 2: Copy function files
echo "📋 Step 2: Copying function files..."
if [ -d "src/supabase/functions/server" ]; then
    cp -r src/supabase/functions/server/* supabase/functions/${FUNCTION_NAME}/
    echo "✅ Function files copied"
else
    echo "❌ Source directory not found: src/supabase/functions/server"
    exit 1
fi

# Step 3: Check authentication
echo ""
echo "🔐 Step 3: Checking authentication..."

# Check if token was provided as first argument
if [ -n "$1" ]; then
    export SUPABASE_ACCESS_TOKEN="$1"
    echo "✅ Using token provided as argument"
elif [ -n "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "✅ Using SUPABASE_ACCESS_TOKEN from environment"
else
    echo "⚠️  SUPABASE_ACCESS_TOKEN not set"
    echo ""
    echo "Usage options:"
    echo "  1. Pass token as argument: ./deploy-server.sh your_token_here"
    echo "  2. Set environment variable: export SUPABASE_ACCESS_TOKEN=your_token && ./deploy-server.sh"
    echo "  3. Login interactively: npx supabase login (then run this script)"
    echo ""
    echo "To get your token, visit: https://supabase.com/dashboard/account/tokens"
    echo ""
    exit 1
fi

# Step 4: Deploy function
echo ""
echo "🚀 Step 4: Deploying function '${FUNCTION_NAME}' to project ${PROJECT_REF}..."
npx supabase functions deploy ${FUNCTION_NAME} --project-ref ${PROJECT_REF}

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Function URL: https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_NAME}"
echo ""

