#!/bin/bash

# ============================================================================
# DEPLOY BACKEND (SUPABASE FUNCTIONS)
# ============================================================================
# Deploys all Supabase Edge Functions to production
# Date: 2025-01-22
# ============================================================================

set -e

echo "🚀 Deploying Backend (Supabase Functions)..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI not found"
  echo "   Installing Supabase CLI..."
  npm install -g supabase || {
    echo "   ⚠️  Installation failed. Please install manually:"
    echo "   npm install -g supabase"
    echo "   OR: brew install supabase/tap/supabase"
    exit 1
  }
fi

echo "✅ Supabase CLI found: $(supabase --version 2>/dev/null || echo 'installed')"
echo ""

# Check if logged in
if ! supabase projects list &> /dev/null 2>&1; then
  echo "⚠️  Not logged in to Supabase"
  echo "   Please login: supabase login"
  exit 1
fi

# Get project reference from existing deployment docs
PROJECT_REF="${SUPABASE_PROJECT_REF:-vpvpbdwtyugbknrntkho}"

echo "📦 Deploying functions to project: $PROJECT_REF"
echo ""

# Deploy main server function
echo "✅ Deploying make-server-3dd53475..."
cd supabase/functions/make-server-3dd53475

supabase functions deploy make-server-3dd53475 --project-ref "$PROJECT_REF" || {
  echo "⚠️  Deployment failed. Trying from project root..."
  cd ../../..
  supabase functions deploy make-server-3dd53475 --project-ref "$PROJECT_REF"
}

cd ../../..

echo ""
echo "✅ Backend deployment complete!"
echo ""
echo "📊 Deployment Summary:"
echo "   - Function: make-server-3dd53475"
echo "   - Project: $PROJECT_REF"
echo "   - URL: https://${PROJECT_REF}.supabase.co/functions/v1/make-server-3dd53475"
echo "   - Status: Deployed"
echo ""
echo "🌐 Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
