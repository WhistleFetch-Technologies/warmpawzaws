#!/bin/bash

# ============================================================================
# DEPLOY BACKEND TO SUPABASE
# ============================================================================

set -e

PROJECT_REF="vpvpbdwtyugbknrntkho"
FUNCTION_NAME="make-server-3dd53475"

echo "🚀 Deploying Backend (Supabase Edge Function)..."
echo ""

# Check if logged in
if ! npx supabase projects list &> /dev/null 2>&1; then
  echo "⚠️  Not logged in to Supabase"
  echo "   Please login first:"
  echo "   npx supabase login"
  echo ""
  echo "   Then run this script again."
  exit 1
fi

echo "✅ Authenticated with Supabase"
echo ""

# Ensure function directory exists
if [ ! -d "supabase/functions/${FUNCTION_NAME}" ]; then
  echo "📦 Preparing function structure..."
  mkdir -p "supabase/functions/${FUNCTION_NAME}"
  
  # Copy server files if src directory exists
  if [ -d "src/supabase/functions/server" ]; then
    cp -r src/supabase/functions/server/* "supabase/functions/${FUNCTION_NAME}/"
    echo "✅ Copied server files"
  fi
fi

echo "📦 Deploying function: ${FUNCTION_NAME}..."
echo ""

# Deploy the function
npx supabase functions deploy "${FUNCTION_NAME}" \
  --project-ref "${PROJECT_REF}" \
  --no-verify-jwt

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ ✅ ✅ BACKEND DEPLOYED SUCCESSFULLY! ✅ ✅ ✅"
  echo ""
  echo "📝 Function URL:"
  echo "   https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_NAME}"
  echo ""
  echo "🧪 Test health endpoint:"
  echo "   curl https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_NAME}/health \\"
  echo "     -H \"Authorization: Bearer YOUR_ANON_KEY\""
  echo ""
  echo "📊 View logs:"
  echo "   npx supabase functions logs ${FUNCTION_NAME} --project-ref ${PROJECT_REF}"
  echo ""
else
  echo ""
  echo "❌ Deployment failed. Please check the error messages above."
  exit 1
fi

