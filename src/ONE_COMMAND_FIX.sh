#!/bin/bash

# ============================================
# ONE COMMAND FIX FOR VENDOR NOTIFICATIONS
# ============================================

set -e

echo "🚀 Fixing vendor notification endpoint..."
echo ""

# Check if we're in project root
if [ ! -d "supabase/functions" ]; then
    echo "❌ Error: Run this from your project root directory"
    echo "   cd /path/to/your/warmpawz/project"
    exit 1
fi

# Navigate to functions directory
cd supabase/functions

# Check current state
if [ -d "server" ] && [ ! -d "make-server-3dd53475" ]; then
    echo "📁 Found 'server' directory, renaming to 'make-server-3dd53475'..."
    mv server make-server-3dd53475
    echo "✅ Renamed successfully"
elif [ -d "make-server-3dd53475" ] && [ ! -d "server" ]; then
    echo "✅ Directory already correctly named: make-server-3dd53475"
elif [ -d "server" ] && [ -d "make-server-3dd53475" ]; then
    echo "⚠️  Both directories exist!"
    echo "   Backing up make-server-3dd53475 and using 'server' as primary..."
    mv make-server-3dd53475 "make-server-3dd53475-backup-$(date +%Y%m%d-%H%M%S)"
    mv server make-server-3dd53475
    echo "✅ Reorganized directories"
else
    echo "❌ Cannot find server or make-server-3dd53475 directory"
    exit 1
fi

# Go back to project root
cd ../..

# Deploy
echo ""
echo "📤 Deploying function..."
npx supabase functions deploy make-server-3dd53475

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "🧪 Test the endpoint with:"
echo ""
echo 'curl "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/vendor/notifications/vendor_9876543216?limit=5" \'
echo '  -H "Authorization: Bearer YOUR_ANON_KEY"'
echo ""
echo "✅ Expected: {\"success\":true,\"notifications\":[],...}"
echo ""
echo "🎉 Refresh your vendor app - errors should be gone!"
