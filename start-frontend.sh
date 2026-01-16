#!/bin/bash

# Start Frontend Locally
# Loads environment variables and starts Vite dev server

set -e

echo "🎨 Starting Frontend Locally..."
echo "================================"
echo ""

# Load environment variables from .env file
if [ -f ".env" ]; then
    echo "📦 Loading environment variables from .env file..."
    # Vite automatically loads .env files, but we'll verify
    echo "✅ .env file found (Vite will load it automatically)"
else
    echo "⚠️  .env file not found"
    if [ -f ".env.example" ]; then
        echo "   Found .env.example - copying to .env..."
        cp .env.example .env
        echo "   ✅ Created .env file from .env.example"
        echo "   ⚠️  Please edit .env file and add your actual credentials"
        echo "   Frontend will start but may have missing features"
    else
        echo "   ⚠️  No .env file found. Frontend will start but may have missing features"
    fi
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start Vite dev server
echo ""
echo "🚀 Starting Vite dev server..."
echo "   Frontend will be available at: http://localhost:5173"
echo "   (or check the terminal output for the actual port)"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""

npm run dev

