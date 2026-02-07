#!/bin/bash

# ============================================================================
# DEPLOY BACKEND WITH ENV FILE
# ============================================================================
# Deploys Supabase Edge Function using credentials from .env file
# ============================================================================

set -e

echo "🚀 Deploying Backend (Supabase Functions) with .env credentials..."
echo ""

# Load environment variables from .env file
if [ -f ".env" ]; then
  echo "📋 Loading environment from .env file..."
  export $(grep -v '^#' .env | xargs)
  echo "✅ Environment loaded"
else
  echo "⚠️  .env file not found, checking for SUPABASE_ACCESS_TOKEN in environment..."
fi

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null && ! command -v npx &> /dev/null; then
  echo "❌ Supabase CLI not found"
  echo "   Installing via npx..."
fi

# Use npx if supabase is not in PATH
SUPABASE_CMD="npx supabase"
if command -v supabase &> /dev/null; then
  SUPABASE_CMD="supabase"
fi

# Get project reference
PROJECT_REF="${SUPABASE_PROJECT_REF:-vpvpbdwtyugbknrntkho}"
if [ -z "$SUPABASE_PROJECT_REF" ] && [ ! -z "$PROJECT_REF" ]; then
  export SUPABASE_PROJECT_REF="$PROJECT_REF"
fi

echo "📦 Project Reference: $PROJECT_REF"
echo ""

# Check for access token
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "⚠️  SUPABASE_ACCESS_TOKEN not found in environment"
  echo ""
  echo "💡 Options:"
  echo "   1. Add SUPABASE_ACCESS_TOKEN to .env file"
  echo "   2. Run: npx supabase login (interactive)"
  echo ""
  echo "   Trying interactive login..."
  $SUPABASE_CMD login || {
    echo "❌ Login failed. Please:"
    echo "   1. Add SUPABASE_ACCESS_TOKEN to .env file, OR"
    echo "   2. Run: npx supabase login"
    exit 1
  }
else
  echo "✅ Access token found"
  export SUPABASE_ACCESS_TOKEN
fi

# Ensure function directory exists
if [ ! -d "supabase/functions/make-server-3dd53475" ]; then
  echo "📦 Preparing function directory..."
  mkdir -p "supabase/functions/make-server-3dd53475"
  
  if [ -d "src/supabase/functions/server" ]; then
    echo "📋 Copying server files..."
    cp -r src/supabase/functions/server/* "supabase/functions/make-server-3dd53475/" 2>/dev/null || true
  fi
fi

echo ""
echo "📦 Deploying function: make-server-3dd53475..."
echo ""

# Deploy the function
echo "✅ Deploying function with project reference..."
$SUPABASE_CMD functions deploy make-server-3dd53475 \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ ✅ ✅ BACKEND DEPLOYED SUCCESSFULLY! ✅ ✅ ✅"
  echo ""
  echo "📝 Function URL:"
  echo "   https://${PROJECT_REF}.supabase.co/functions/v1/make-server-3dd53475"
  echo ""
  echo "🧪 Test health endpoint:"
  echo "   curl https://${PROJECT_REF}.supabase.co/functions/v1/make-server-3dd53475/health"
  echo ""
  echo "📊 View logs:"
  echo "   $SUPABASE_CMD functions logs make-server-3dd53475 --project-ref $PROJECT_REF"
  echo ""
else
  echo ""
  echo "❌ Deployment failed. Please check the error messages above."
  exit 1
fi

