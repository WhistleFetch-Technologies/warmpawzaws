#!/bin/bash
# ============================================================================
# DEPLOY FIXES AND RE-TEST
# ============================================================================
# Deploys code fixes, executes migrations, and re-runs test suite
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"

echo "🚀 Deploy Fixes and Re-Test"
echo "============================================================"
echo "Environment: $ENVIRONMENT"
echo ""

# Step 1: Deploy code fixes
echo "📦 Step 1: Deploying code fixes..."
./scripts/deploy-code-fixes.sh "$ENVIRONMENT"

echo ""
echo "⏸️  Please verify code deployment completed successfully"
echo "   Press Enter to continue with migrations, or Ctrl+C to cancel..."
read

# Step 2: Execute migrations
echo ""
echo "🔄 Step 2: Executing database migrations..."
./scripts/execute-migrations-059-061.sh "$ENVIRONMENT"

echo ""
echo "⏸️  Please verify migrations executed successfully"
echo "   Press Enter to continue with testing, or Ctrl+C to cancel..."
read

# Step 3: Re-run test suite
echo ""
echo "🧪 Step 3: Re-running test suite..."
./scripts/run-full-test-suite.sh "$ENVIRONMENT"

echo ""
echo "============================================================"
echo "✅ Deployment and Testing Complete"
echo "============================================================"
