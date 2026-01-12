#!/bin/bash

# Local Sentry Testing Script
# Tests Sentry error tracking without deploying to Lambda

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Sentry Local Testing Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found"
    echo ""
    echo "📝 Please create .env.local with:"
    echo "   SENTRY_DSN=https://your-dsn@sentry.io/project-id"
    echo "   ENABLE_ERROR_TRACKING=true"
    echo ""
    echo "💡 Get your DSN from: https://sentry.io"
    echo "   1. Create account"
    echo "   2. Create project (Node.js/AWS Lambda)"
    echo "   3. Copy DSN"
    echo ""
    exit 1
fi

# Check if SENTRY_DSN is set
if ! grep -q "SENTRY_DSN=" .env.local; then
    echo "⚠️  SENTRY_DSN not found in .env.local"
    echo ""
    echo "📝 Please add to .env.local:"
    echo "   SENTRY_DSN=https://your-dsn@sentry.io/project-id"
    echo "   ENABLE_ERROR_TRACKING=true"
    echo ""
    exit 1
fi

# Load environment variables
echo "📋 Loading environment variables from .env.local..."
export $(grep -v '^#' .env.local | xargs)
echo "✅ Environment loaded"
echo ""

# Check if DSN is set
if [ -z "$SENTRY_DSN" ]; then
    echo "❌ SENTRY_DSN is not set"
    echo "   Please check .env.local"
    exit 1
fi

echo "🔍 Configuration:"
echo "   DSN: ${SENTRY_DSN:0:30}..."
echo "   Enabled: ${ENABLE_ERROR_TRACKING:-true}"
echo ""

# Navigate to lambda directory
cd backend/lambda

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if Sentry is installed
if [ ! -d "node_modules/@sentry" ]; then
    echo "📦 Installing Sentry SDK..."
    npm install @sentry/serverless@^7.120.4
    echo ""
fi

# Run test script
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Running Sentry tests..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node scripts/test-sentry.js

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Testing complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Next steps:"
echo "   1. Go to https://sentry.io"
echo "   2. Navigate to your project"
echo "   3. Check 'Issues' tab"
echo "   4. You should see test events"
echo ""
echo "⏱️  Note: Events may take 10-30 seconds to appear"
echo ""
