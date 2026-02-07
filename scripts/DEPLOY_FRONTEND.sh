#!/bin/bash

# ============================================================================
# DEPLOY FRONTEND
# ============================================================================

set -e

echo "🚀 Deploying Frontend..."
echo ""

# Build frontend if not already built
if [ ! -d "build" ]; then
  echo "📦 Building frontend..."
  npm run build
  echo "✅ Build complete"
  echo ""
fi

echo "✅ Build directory ready: $(du -sh build 2>/dev/null | cut -f1 || echo 'ready')"
echo ""

# Try Vercel first
if command -v vercel &> /dev/null; then
  echo "✅ Vercel CLI found"
  echo "📦 Deploying to Vercel..."
  vercel --prod
  echo "✅ Frontend deployed to Vercel"
  exit 0
fi

# Try Netlify
if command -v netlify &> /dev/null; then
  echo "✅ Netlify CLI found"
  echo "📦 Deploying to Netlify..."
  netlify deploy --prod --dir=build
  echo "✅ Frontend deployed to Netlify"
  exit 0
fi

# Try with npx
if command -v npm &> /dev/null; then
  echo "📦 Trying Vercel via npx..."
  npx vercel --prod 2>&1 | head -20 || {
    echo ""
    echo "⚠️  Deployment CLI not available"
    echo ""
    echo "💡 Install a deployment CLI:"
    echo "   npm install -g vercel"
    echo "   OR"
    echo "   npm install -g netlify-cli"
    echo ""
    echo "📦 Your build is ready in the 'build/' directory"
    echo "   You can manually upload it to any hosting service"
    exit 1
  }
  exit 0
fi

echo "❌ No deployment method available"
exit 1

