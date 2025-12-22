#!/bin/bash

# Quick script to push to new 'aws' repository
# Usage: ./PUSH_COMMANDS.sh YOUR_GITHUB_USERNAME

if [ -z "$1" ]; then
    echo "❌ Error: Please provide your GitHub username"
    echo "Usage: ./PUSH_COMMANDS.sh YOUR_GITHUB_USERNAME"
    exit 1
fi

USERNAME=$1

echo "🚀 Setting up remote and pushing to 'aws' repository..."
echo ""

# Add remote
echo "📦 Adding remote 'origin'..."
git remote add origin https://github.com/${USERNAME}/aws.git

# Ensure on main branch
echo "🌿 Ensuring on main branch..."
git branch -M main

# Push
echo "⬆️  Pushing to remote..."
git push -u origin main

echo ""
echo "✅ Done! Your codebase is now at: https://github.com/${USERNAME}/aws"
echo ""
echo "🔍 Verify on GitHub:"
echo "   - node_modules folder should NOT be present"
echo "   - All source files should be present"
echo "   - .gitignore should be in root"

