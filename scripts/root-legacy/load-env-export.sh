#!/bin/bash

# Export Environment Variables to Current Shell
# Usage: source load-env-export.sh
# This will export all variables from .env to your current shell session

ENV_FILE=".env"

if [ -f "$ENV_FILE" ]; then
    echo "📦 Loading environment variables from .env..."
    
    # Export all variables from .env
    set -a
    source "$ENV_FILE"
    set +a
    
    echo "✅ Environment variables exported to current shell"
    echo ""
    echo "📋 Available variables:"
    env | grep -E "^(VITE_|SUPABASE_)" | sed 's/=.*/=***/' || echo "   (No VITE_ or SUPABASE_ variables found)"
    echo ""
else
    echo "❌ .env file not found"
    return 1 2>/dev/null || exit 1
fi

