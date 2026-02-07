#!/bin/bash
# Script to trigger GitHub Actions workflow deployment

set -e

REPO="ketan0103/warmpawzaws"
WORKFLOW_FILE="dev.yml"
BRANCH="develop"

echo "🚀 Triggering Development Deployment Workflow"
echo "=============================================="
echo ""
echo "Repository: $REPO"
echo "Workflow: $WORKFLOW_FILE"
echo "Branch: $BRANCH"
echo ""

# Check for GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN not found in environment"
    echo ""
    echo "📋 To get a GitHub token:"
    echo "   1. Go to: https://github.com/settings/tokens"
    echo "   2. Click 'Generate new token' → 'Generate new token (classic)'"
    echo "   3. Name: 'Workflow Trigger'"
    echo "   4. Select scope: ✅ 'workflow'"
    echo "   5. Click 'Generate token'"
    echo "   6. Copy the token"
    echo ""
    read -p "Enter your GitHub Personal Access Token: " GITHUB_TOKEN
    echo ""
fi

# Trigger the workflow
echo "🔄 Triggering workflow..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$REPO/actions/workflows/$WORKFLOW_FILE/dispatches" \
  -d "{\"ref\":\"$BRANCH\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "204" ]; then
    echo "✅ Workflow triggered successfully!"
    echo ""
    echo "📊 Monitor deployment at:"
    echo "   https://github.com/$REPO/actions/workflows/$WORKFLOW_FILE"
    echo ""
    echo "The deployment will:"
    echo "  ✅ Build backend Lambda handlers"
    echo "  ✅ Build all frontend apps (admin, vendor, customer)"
    echo "  ✅ Build Android mobile apps"
    echo "  ✅ Deploy infrastructure (if changes detected)"
    echo "  ✅ Deploy frontend apps to S3/CloudFront"
    echo "  ✅ Run smoke tests"
    exit 0
elif [ "$HTTP_CODE" = "401" ]; then
    echo "❌ Authentication failed. Please check your token."
    exit 1
elif [ "$HTTP_CODE" = "404" ]; then
    echo "❌ Workflow not found. Please check the workflow file name."
    exit 1
else
    echo "❌ Failed to trigger workflow. HTTP Code: $HTTP_CODE"
    echo "Response: $BODY"
    exit 1
fi

