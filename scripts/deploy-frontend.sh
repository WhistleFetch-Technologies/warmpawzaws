#!/bin/bash

# ============================================================================
# DEPLOY FRONTEND
# ============================================================================
# Deploys frontend to production (Vercel/Netlify/Static Hosting)
# Date: 2025-01-22
# ============================================================================

set -e

echo "🚀 Deploying Frontend..."
echo ""

# Build frontend first if not already built
if [ ! -d "build" ]; then
  echo "📦 Building frontend..."
  npm run build || {
    echo "❌ Build failed"
    exit 1
  }
fi

echo "✅ Build directory ready: $(du -sh build | cut -f1)"
echo ""

# Check if Vercel CLI is installed
if command -v vercel &> /dev/null; then
  echo "✅ Vercel CLI found"
  echo "📦 Deploying to Vercel..."
  vercel --prod || {
    echo "⚠️  Vercel deployment failed"
    exit 1
  }
  echo "✅ Frontend deployed to Vercel"
  exit 0
fi

# Check if Netlify CLI is installed
if command -v netlify &> /dev/null; then
  echo "✅ Netlify CLI found"
  echo "📦 Deploying to Netlify..."
  netlify deploy --prod --dir=build || {
    echo "⚠️  Netlify deployment failed"
    exit 1
  }
  echo "✅ Frontend deployed to Netlify"
  exit 0
fi

# No CLI found, provide instructions
echo "⚠️  No deployment CLI found"
echo ""
echo "💡 Installation options:"
echo ""
echo "Option 1: Vercel (Recommended)"
echo "   npm install -g vercel"
echo "   vercel login"
echo "   vercel --prod"
echo ""
echo "Option 2: Netlify"
echo "   npm install -g netlify-cli"
echo "   netlify login"
echo "   netlify deploy --prod --dir=build"
echo ""
echo "Option 3: Manual deployment"
echo "   Upload build/ directory to your hosting provider"
echo ""

# Check if we're in a git repo
if [ -d ".git" ] && git remote get-url origin &> /dev/null; then
  echo "📋 Git repository detected"
  echo "   You can also deploy via:"
  echo "   - GitHub Pages"
  echo "   - Vercel (connect GitHub repo)"
  echo "   - Netlify (connect GitHub repo)"
fi

exit 1
