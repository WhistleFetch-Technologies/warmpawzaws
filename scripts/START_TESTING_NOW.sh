#!/bin/bash

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║        🚀 STARTING ADMIN UI TESTING NOW                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if we're in the right directory
if [ ! -d "apps/admin-web" ]; then
    echo "❌ Error: apps/admin-web directory not found"
    echo "   Please run this from the project root"
    exit 1
fi

echo "✅ Project structure verified"
echo ""

# Check if node_modules exists
if [ ! -d "apps/admin-web/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd apps/admin-web
    npm install
    cd ../..
    echo "✅ Dependencies installed"
    echo ""
fi

echo "🚀 Starting Admin UI..."
echo ""
echo "   The UI will be available at: http://localhost:3000"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""
echo "────────────────────────────────────────────────────────────"
echo ""

cd apps/admin-web
npm run dev

