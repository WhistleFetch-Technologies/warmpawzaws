#!/bin/bash

# Load Environment Variables Script
# This script helps set up and load environment variables for the project

set -e

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

echo "🔧 Environment Variables Setup"
echo "================================"
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "📝 .env file not found. Creating from template..."
    
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo "✅ Created .env file from .env.example"
        echo ""
        echo "⚠️  Please edit .env file and add your actual values:"
        echo "   - VITE_GOOGLE_MAPS_API_KEY"
        echo "   - VITE_RAZORPAY_KEY_ID (if needed)"
        echo ""
    else
        echo "❌ .env.example not found. Creating basic .env file..."
        cat > "$ENV_FILE" << 'EOF'
# Environment Variables
VITE_GOOGLE_MAPS_API_KEY=
VITE_RAZORPAY_KEY_ID=
EOF
        echo "✅ Created basic .env file"
    fi
else
    echo "✅ .env file already exists"
fi

# Load environment variables
echo ""
echo "📦 Loading environment variables..."
if [ -f "$ENV_FILE" ]; then
    # Export variables from .env file
    set -a
    source "$ENV_FILE"
    set +a
    
    echo "✅ Environment variables loaded from .env"
    echo ""
    echo "📋 Current environment variables:"
    echo "   VITE_GOOGLE_MAPS_API_KEY: ${VITE_GOOGLE_MAPS_API_KEY:-❌ Not set}"
    echo "   VITE_RAZORPAY_KEY_ID: ${VITE_RAZORPAY_KEY_ID:-❌ Not set}"
    echo ""
    
    # Check if required variables are set
    if [ -z "$VITE_GOOGLE_MAPS_API_KEY" ]; then
        echo "⚠️  Warning: VITE_GOOGLE_MAPS_API_KEY is not set"
        echo "   This is required for Google Maps functionality"
    fi
else
    echo "❌ .env file not found"
    exit 1
fi

echo ""
echo "✅ Environment setup complete!"
echo ""
echo "💡 Note: Vite automatically loads .env files when running 'npm run dev'"
echo "   You don't need to manually source this script for Vite to work"
echo ""

