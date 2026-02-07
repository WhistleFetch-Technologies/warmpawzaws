#!/bin/bash

# Quick push script - run this AFTER creating the repository on GitHub

set -e

REPO_NAME="warmpawzaws"
USERNAME="ketan0103"

echo "🚀 Pushing to repository '${REPO_NAME}'..."
echo ""

# Remove old remote if exists
git remote remove origin 2>/dev/null || true

# Add remote
echo "🔗 Adding remote..."
git remote add origin https://github.com/${USERNAME}/${REPO_NAME}.git

# Ensure on main branch
echo "🌿 Ensuring on main branch..."
git branch -M main

# Push
echo "⬆️  Pushing code..."
git push -u origin main

echo ""
echo "✅ Success! Your codebase is now at:"
echo "   https://github.com/${USERNAME}/${REPO_NAME}"
echo ""
echo "🔍 Verify on GitHub:"
echo "   - node_modules folder should NOT be present"
echo "   - All source files should be present"
echo "   - .gitignore should be in root"

