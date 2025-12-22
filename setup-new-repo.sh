#!/bin/bash

# Script to set up new git repository and push to remote "aws"

set -e

echo "🚀 Setting up new git repository..."

# Check if .gitignore exists and has node_modules
if ! grep -q "node_modules" .gitignore 2>/dev/null; then
    echo "❌ node_modules not in .gitignore. Please add it first."
    exit 1
fi

# Verify node_modules will be ignored
if git check-ignore node_modules > /dev/null 2>&1; then
    echo "✅ node_modules is properly ignored"
else
    echo "⚠️  Warning: node_modules might not be ignored. Checking..."
fi

# Remove old remote if exists
if git remote get-url origin > /dev/null 2>&1; then
    echo "📦 Removing old remote 'origin'..."
    git remote remove origin
fi

# Add all files (respecting .gitignore)
echo "📝 Adding all files to git..."
git add .

# Check what will be committed
echo ""
echo "📊 Files to be committed:"
git status --short | head -20
echo ""

# Commit all changes
echo "💾 Committing all changes..."
git commit -m "Initial commit: Warmpawz ecosystem codebase

- Complete frontend application (React + Vite)
- Supabase Edge Functions server
- Customer and vendor dashboards
- Admin portal
- E2E test suites
- All features: booking, payments, loyalty, referrals, wallet, GST, etc."

echo ""
echo "✅ Repository ready!"
echo ""
echo "📋 Next steps:"
echo "1. Create a new repository on GitHub/GitLab named 'aws'"
echo "2. Run these commands:"
echo ""
echo "   git remote add origin <your-new-repo-url>"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "Or if you want to use GitHub CLI:"
echo "   gh repo create aws --public --source=. --remote=origin --push"

