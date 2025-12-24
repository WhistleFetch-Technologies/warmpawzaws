#!/bin/bash

# Complete Deployment Script
# 1. Deploys backend to Supabase
# 2. Starts frontend locally

set -e

echo "🚀 Complete Deployment & Local Start"
echo "===================================="
echo ""

# Step 1: Deploy Backend
echo "📦 Step 1: Deploying Backend..."
echo "--------------------------------"
./deploy-backend.sh

if [ $? -ne 0 ]; then
    echo "❌ Backend deployment failed. Aborting."
    exit 1
fi

echo ""
echo "✅ Backend deployed successfully!"
echo ""

# Step 2: Start Frontend
echo "🎨 Step 2: Starting Frontend..."
echo "--------------------------------"
echo "   (This will start in a new process)"
echo ""

# Start frontend in background or new terminal
if command -v osascript &> /dev/null; then
    # macOS - open in new terminal
    osascript -e 'tell app "Terminal" to do script "cd \"'$(pwd)'\" && ./start-frontend.sh"'
    echo "✅ Frontend starting in new terminal window"
    echo ""
    echo "📝 Backend URL: https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475"
    echo "📝 Frontend URL: http://localhost:5173 (check terminal window)"
else
    # Linux/Other - run in background
    ./start-frontend.sh &
    echo "✅ Frontend starting in background"
    echo ""
    echo "📝 Backend URL: https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475"
    echo "📝 Frontend URL: http://localhost:5173"
    echo ""
    echo "   To stop frontend, run: pkill -f 'vite'"
fi

echo ""
echo "✅ ✅ ✅ DEPLOYMENT COMPLETE! ✅ ✅ ✅"
echo ""

