#!/bin/bash
# Quick script to start the backend server for region seeding tests

echo "🚀 Starting Backend Server for Region Seeding Tests..."
echo ""

cd backend/lambda || { echo "❌ Error: backend/lambda directory not found!"; exit 1; }

echo "📁 Current directory: $(pwd)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies first..."
    npm install
    echo ""
fi

echo "🌐 Starting serverless offline..."
echo "   (This will start on http://localhost:3000)"
echo ""
echo "⏳ Wait for: 'Offline [http for lambda] http://localhost:3000'"
echo "   Then go to another terminal and run: ./test-region-seeding.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run start:local
