#!/bin/bash

# Quick deployment script using npx
# This avoids needing to install Supabase CLI globally

set -e

echo "🚀 Quick Server Deployment"
echo "=========================="
echo ""

# Check if function directory exists
if [ ! -d "supabase/functions/make-server-3dd53475" ]; then
    echo "📦 Preparing function structure..."
    mkdir -p supabase/functions/make-server-3dd53475
    cp -r src/supabase/functions/server/* supabase/functions/make-server-3dd53475/
    echo "✅ Function structure prepared"
fi

# Check if linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "⚠️  Project not linked. Linking now..."
    echo "   Project ID: vpvpbdwtyugbknrntkho"
    npx supabase link --project-ref vpvpbdwtyugbknrntkho
fi

# Check if logged in
echo ""
echo "🔐 Checking authentication..."
if ! npx supabase projects list &> /dev/null; then
    echo "⚠️  Not logged in. Please login first:"
    echo "   npx supabase login"
    echo ""
    echo "After logging in, run this script again."
    exit 1
fi

# Deploy
echo ""
echo "🚀 Deploying function..."
npx supabase functions deploy make-server-3dd53475 --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📝 Function URL:"
    echo "   https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475"
    echo ""
    echo "🧪 Test with:"
    echo "   curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/health"
else
    echo ""
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi

