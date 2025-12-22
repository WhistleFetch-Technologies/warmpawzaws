#!/bin/bash

# Script to create GitHub repository and push code
# Usage: ./create-and-push.sh [GITHUB_TOKEN]

set -e

REPO_NAME="warmpawzaws"
USERNAME="ketan0103"
GITHUB_TOKEN="${1:-$GITHUB_TOKEN}"

echo "🚀 Creating repository '${REPO_NAME}' and pushing code..."
echo ""

# Check if token is available
if [ -z "$GITHUB_TOKEN" ]; then
    echo "⚠️  GITHUB_TOKEN not found."
    echo ""
    echo "📋 Please create the repository manually:"
    echo "   1. Go to: https://github.com/new"
    echo "   2. Repository name: ${REPO_NAME}"
    echo "   3. Choose Public or Private"
    echo "   4. DO NOT initialize with README"
    echo "   5. Click 'Create repository'"
    echo ""
    echo "Then run:"
    echo "   git remote add origin https://github.com/${USERNAME}/${REPO_NAME}.git"
    echo "   git push -u origin main"
    exit 1
fi

# Create repository via API
echo "📦 Creating repository via GitHub API..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"${REPO_NAME}\",\"private\":false}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
    echo "✅ Repository created successfully!"
elif [ "$HTTP_CODE" = "422" ]; then
    echo "⚠️  Repository might already exist, continuing..."
elif [ "$HTTP_CODE" = "401" ]; then
    echo "❌ Authentication failed. Please check your GITHUB_TOKEN."
    exit 1
else
    echo "❌ Failed to create repository. HTTP Code: $HTTP_CODE"
    echo "Response: $BODY"
    exit 1
fi

# Add remote (remove if exists)
echo ""
echo "🔗 Setting up remote..."
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/${USERNAME}/${REPO_NAME}.git

# Ensure on main branch
echo "🌿 Ensuring on main branch..."
git branch -M main

# Push
echo ""
echo "⬆️  Pushing to remote..."
git push -u origin main

echo ""
echo "✅ Success! Repository is now at:"
echo "   https://github.com/${USERNAME}/${REPO_NAME}"

