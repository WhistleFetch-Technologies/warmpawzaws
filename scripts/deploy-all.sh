#!/bin/bash

# ============================================================================
# DEPLOY ALL (BACKEND + FRONTEND)
# ============================================================================
# Deploys both backend and frontend to production
# Date: 2025-01-22
# ============================================================================

set -e

echo "🚀 Deploying Complete Platform..."
echo ""

# Deploy backend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 DEPLOYING BACKEND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

./scripts/deploy-backend.sh || {
  echo "❌ Backend deployment failed"
  exit 1
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 DEPLOYING FRONTEND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

./scripts/deploy-frontend.sh || {
  echo "❌ Frontend deployment failed"
  exit 1
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Deployment Summary:"
echo "   ✅ Backend: Deployed"
echo "   ✅ Frontend: Deployed"
echo ""
echo "🌐 Your platform is now live!"
