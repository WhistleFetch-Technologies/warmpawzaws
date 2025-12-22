#!/bin/bash

# ============================================================================
# Quick Script: Populate Problem Grid Mappings
# ============================================================================

set -e

PROJECT_URL="https://vpvpbdwtyugbknrntkho.supabase.co"
ENDPOINT="${PROJECT_URL}/functions/v1/make-server-3dd53475/admin/populate-problem-grid-mappings"

echo "🔄 Populating Problem Grid Mappings..."
echo ""

# Check if SERVICE_ROLE_KEY is provided as argument
if [ -n "$1" ]; then
    SERVICE_ROLE_KEY="$1"
elif [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
else
    echo "❌ Service Role Key required!"
    echo ""
    echo "Usage:"
    echo "  $0 YOUR_SERVICE_ROLE_KEY"
    echo ""
    echo "Or set environment variable:"
    echo "  export SUPABASE_SERVICE_ROLE_KEY=your_key"
    echo "  $0"
    echo ""
    echo "Get your key from: Supabase Dashboard → Settings → API → service_role"
    exit 1
fi

echo "Calling endpoint..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SERVICE_ROLE_KEY")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ Success!"
    echo ""
    if command -v jq &> /dev/null; then
        echo "$BODY" | jq '.'
    else
        echo "$BODY"
    fi
else
    echo "❌ Error (HTTP $HTTP_CODE)"
    echo ""
    echo "$BODY"
    exit 1
fi

