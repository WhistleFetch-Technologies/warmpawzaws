#!/bin/bash
# Setup GitHub Secrets for Warmpawz CI/CD
# Usage: ./scripts/setup-github-secrets.sh

set -e

REPO="ketan0103/warmpawzaws"

echo "🔐 Setting up GitHub Secrets for $REPO"
echo "========================================"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first."
    echo "   brew install gh (macOS)"
    echo "   or visit https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI. Please run: gh auth login"
    exit 1
fi

echo ""
echo "📝 Setting AWS Credentials..."
gh secret set AWS_ACCESS_KEY_ID --repo "$REPO" --body "AKIAQK4TGNEFLQJLXMMI"
gh secret set AWS_SECRET_ACCESS_KEY --repo "$REPO" --body "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"
echo "✅ AWS credentials set"

echo ""
echo "📝 Setting Razorpay Credentials..."
gh secret set RAZORPAY_KEY_ID --repo "$REPO" --body "rzp_test_Rnp57suJH3wzUl"
gh secret set RAZORPAY_KEY_SECRET --repo "$REPO" --body "rplcWAxtmVfvXI9uydFt7YkH"
echo "✅ Razorpay credentials set"

echo ""
echo "📝 Setting Google Maps API Key..."
gh secret set GOOGLE_MAPS_API_KEY --repo "$REPO" --body "AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0"
echo "✅ Google Maps API key set"

echo ""
echo "📝 Setting Shiprocket Credentials..."
gh secret set SHIPROCKET_EMAIL --repo "$REPO" --body "ketanh@warmpawz.com"
gh secret set SHIPROCKET_PASSWORD --repo "$REPO" --body 'znoMnd9FkntmRuXCq$d@eKfQj1M8oXGj'
echo "✅ Shiprocket credentials set"

echo ""
echo "📝 Setting OpenSearch Password (generated)..."
OPENSEARCH_PWD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 20)
gh secret set DEV_OPENSEARCH_PASSWORD --repo "$REPO" --body "${OPENSEARCH_PWD}Aa1!"
gh secret set STAGE_OPENSEARCH_PASSWORD --repo "$REPO" --body "${OPENSEARCH_PWD}Bb2!"
gh secret set PROD_OPENSEARCH_PASSWORD --repo "$REPO" --body "${OPENSEARCH_PWD}Cc3!"
echo "✅ OpenSearch passwords set"

echo ""
echo "========================================"
echo "✅ All secrets configured successfully!"
echo ""
echo "📋 Summary of secrets set:"
echo "   - AWS_ACCESS_KEY_ID"
echo "   - AWS_SECRET_ACCESS_KEY"
echo "   - RAZORPAY_KEY_ID"
echo "   - RAZORPAY_KEY_SECRET"
echo "   - GOOGLE_MAPS_API_KEY"
echo "   - SHIPROCKET_EMAIL"
echo "   - SHIPROCKET_PASSWORD"
echo "   - DEV_OPENSEARCH_PASSWORD"
echo "   - STAGE_OPENSEARCH_PASSWORD"
echo "   - PROD_OPENSEARCH_PASSWORD"
echo ""
echo "🚀 You can now run the GitHub Actions workflows!"
