#!/bin/bash

# Quick test runner for vendor onboarding endpoints
# Usage: ./run-onboarding-tests.sh [bash|node]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if environment variables are set
if [ -z "$SUPABASE_PROJECT_ID" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "⚠️  Environment variables not set!"
    echo ""
    echo "Please set:"
    echo "  export SUPABASE_PROJECT_ID='your-project-id'"
    echo "  export SUPABASE_ANON_KEY='your-anon-key'"
    echo ""
    echo "Or create a .env file with:"
    echo "  SUPABASE_PROJECT_ID=your-project-id"
    echo "  SUPABASE_ANON_KEY=your-anon-key"
    echo ""
    
    # Try to load from .env if it exists
    if [ -f "$SCRIPT_DIR/.env" ]; then
        echo "📄 Loading from .env file..."
        export $(cat "$SCRIPT_DIR/.env" | grep -v '^#' | xargs)
    else
        echo "❌ No .env file found. Exiting."
        exit 1
    fi
fi

# Choose test script
TEST_TYPE="${1:-bash}"

if [ "$TEST_TYPE" = "node" ]; then
    echo "🚀 Running Node.js tests..."
    node "$SCRIPT_DIR/test-vendor-onboarding-endpoints.js"
elif [ "$TEST_TYPE" = "bash" ]; then
    echo "🚀 Running Bash tests..."
    bash "$SCRIPT_DIR/test-vendor-onboarding-endpoints.sh"
else
    echo "Usage: $0 [bash|node]"
    exit 1
fi

