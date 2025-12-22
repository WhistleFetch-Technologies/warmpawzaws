#!/bin/bash

# Deployment script - Run this after logging in to Supabase
# Usage: ./deploy-now.sh

set -e

echo "🚀 Deploying Supabase Edge Function..."
echo "======================================"
echo ""

# Ensure function directory exists
if [ ! -d "supabase/functions/make-server-3dd53475" ]; then
    echo "📦 Preparing function structure..."
    mkdir -p supabase/functions/make-server-3dd53475
    cp -r src/supabase/functions/server/* supabase/functions/make-server-3dd53475/
    echo "✅ Function structure prepared"
fi

# Check if linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "⚠️  Linking project..."
    npx supabase link --project-ref vpvpbdwtyugbknrntkho
fi

# Deploy
echo ""
echo "🚀 Deploying function: make-server-3dd53475..."
echo ""
npx supabase functions deploy make-server-3dd53475 --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ✅ ✅ DEPLOYMENT SUCCESSFUL! ✅ ✅ ✅"
    echo ""
    echo "📝 Function URL:"
    echo "   https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475"
    echo ""
    echo "🧪 Test health endpoint:"
    echo "   curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/health"
    echo ""
    echo "📊 View logs:"
    echo "   npx supabase functions logs make-server-3dd53475"
    echo ""
else
    echo ""
    echo "❌ Deployment failed. Please check the error messages above."
    exit 1
fi

