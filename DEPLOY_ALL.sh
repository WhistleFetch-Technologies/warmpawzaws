#!/bin/bash

# ============================================================================
# DEPLOY ALL (BACKEND + FRONTEND)
# ============================================================================

set -e

echo "🚀 Deploying Complete Platform..."
echo ""

# Deploy backend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 DEPLOYING BACKEND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

./DEPLOY_BACKEND.sh || {
  echo "❌ Backend deployment failed"
  echo "   Make sure you're logged in: npx supabase login"
  exit 1
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 DEPLOYING FRONTEND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

./DEPLOY_FRONTEND.sh || {
  echo "⚠️  Frontend deployment skipped or failed"
  echo "   Build is ready in build/ directory"
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

