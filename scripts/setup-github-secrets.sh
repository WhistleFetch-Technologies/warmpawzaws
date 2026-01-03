#!/bin/bash
# GitHub Secrets Setup Script
# ⚠️ WARNING: This file contains sensitive credentials
# DO NOT commit this file to git
# Add to .gitignore immediately

set -e

echo "🔐 Setting up GitHub Secrets for Warmpawz"
echo "=========================================="
echo ""
echo "⚠️  IMPORTANT: You'll need GitHub CLI (gh) installed"
echo "Install: brew install gh (Mac) or see https://cli.github.com/"
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Please install it first."
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "🔑 Please authenticate with GitHub first..."
    gh auth login
fi

REPO="ketan/warmpawzecodev"  # Update with your actual repo

echo "📝 Setting up secrets for repository: $REPO"
echo ""

# AWS Credentials
echo "Setting AWS credentials..."
gh secret set AWS_ACCESS_KEY_ID -b"AKIAQK4TGNEFLQJLXMMI" -R "$REPO"
gh secret set AWS_SECRET_ACCESS_KEY -b"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" -R "$REPO"
gh secret set AWS_REGION -b"ap-south-1" -R "$REPO"

# Get AWS Account ID
echo "Getting AWS Account ID..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "⚠️  Could not get AWS Account ID. Please enter manually:"
    read -p "AWS Account ID: " AWS_ACCOUNT_ID
fi
gh secret set AWS_ACCOUNT_ID -b"$AWS_ACCOUNT_ID" -R "$REPO"

# Razorpay
echo "Setting Razorpay credentials..."
gh secret set RAZORPAY_KEY_ID -b"rzp_test_Rnp57suJH3wzUl" -R "$REPO"
gh secret set RAZORPAY_KEY_SECRET -b"rplcWAxtmVfvXI9uydFt7YkH" -R "$REPO"

# Note: Webhook secret needs to be generated in Razorpay dashboard
echo ""
echo "⚠️  Razorpay Webhook Secret:"
echo "   1. Go to https://dashboard.razorpay.com/app/webhooks"
echo "   2. Create a webhook or copy existing webhook secret"
read -p "   Enter Razorpay Webhook Secret: " RAZORPAY_WEBHOOK
if [ ! -z "$RAZORPAY_WEBHOOK" ]; then
    gh secret set RAZORPAY_WEBHOOK_SECRET -b"$RAZORPAY_WEBHOOK" -R "$REPO"
fi

# Google Maps
echo "Setting Google Maps API key..."
gh secret set GOOGLE_MAPS_API_KEY -b"AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0" -R "$REPO"

# Shiprocket
echo "Setting Shiprocket credentials..."
gh secret set SHIPROCKET_EMAIL -b"ketanh@warmpawz.com" -R "$REPO"
gh secret set SHIPROCKET_PASSWORD -b"znoMnd9FkntmRuXCq\$d@eKfQj1M8oXGj." -R "$REPO"

# OpenSearch Passwords (generate strong passwords)
echo ""
echo "📝 OpenSearch Passwords (generate strong passwords):"
read -sp "Enter OpenSearch password for DEV (optional, press enter to skip): " DEV_OPENSEARCH_PASSWORD
echo ""
if [ ! -z "$DEV_OPENSEARCH_PASSWORD" ]; then
    gh secret set DEV_OPENSEARCH_PASSWORD -b"$DEV_OPENSEARCH_PASSWORD" -R "$REPO"
fi

read -sp "Enter OpenSearch password for STAGE: " STAGE_OPENSEARCH_PASSWORD
echo ""
gh secret set STAGE_OPENSEARCH_PASSWORD -b"$STAGE_OPENSEARCH_PASSWORD" -R "$REPO"

read -sp "Enter OpenSearch password for PROD: " PROD_OPENSEARCH_PASSWORD
echo ""
gh secret set PROD_OPENSEARCH_PASSWORD -b"$PROD_OPENSEARCH_PASSWORD" -R "$REPO"

# Frontend Public Keys (environment-specific)
echo ""
echo "Setting frontend public keys..."
gh secret set NEXT_PUBLIC_RAZORPAY_KEY_DEV -b"rzp_test_Rnp57suJH3wzUl" -R "$REPO"
gh secret set NEXT_PUBLIC_RAZORPAY_KEY_STAGE -b"rzp_test_Rnp57suJH3wzUl" -R "$REPO"
# For production, you'll need the live key
read -p "Enter Razorpay LIVE key for production (or press enter to use test key): " RAZORPAY_LIVE_KEY
if [ -z "$RAZORPAY_LIVE_KEY" ]; then
    RAZORPAY_LIVE_KEY="rzp_test_Rnp57suJH3wzUl"
fi
gh secret set NEXT_PUBLIC_RAZORPAY_KEY_PROD -b"$RAZORPAY_LIVE_KEY" -R "$REPO"

# API URLs
gh secret set NEXT_PUBLIC_API_BASE_URL_DEV -b"https://dev.api.warmpawz.com" -R "$REPO"
gh secret set NEXT_PUBLIC_API_BASE_URL_STAGE -b"https://stage.api.warmpawz.com" -R "$REPO"
gh secret set NEXT_PUBLIC_API_BASE_URL_PROD -b"https://api.warmpawz.com" -R "$REPO"

# Optional: Slack webhook
echo ""
read -p "Enter Slack Webhook URL (optional, press enter to skip): " SLACK_WEBHOOK
if [ ! -z "$SLACK_WEBHOOK" ]; then
    gh secret set SLACK_WEBHOOK_URL -b"$SLACK_WEBHOOK" -R "$REPO"
fi

# Optional: Stripe (if you have it)
echo ""
read -p "Do you have Stripe credentials? (y/n): " HAS_STRIPE
if [ "$HAS_STRIPE" == "y" ]; then
    read -p "Enter Stripe Secret Key: " STRIPE_SECRET
    read -p "Enter Stripe Publishable Key: " STRIPE_PUBLIC
    read -p "Enter Stripe Webhook Secret: " STRIPE_WEBHOOK
    
    gh secret set STRIPE_SECRET_KEY -b"$STRIPE_SECRET" -R "$REPO"
    gh secret set STRIPE_PUBLISHABLE_KEY -b"$STRIPE_PUBLIC" -R "$REPO"
    gh secret set STRIPE_WEBHOOK_SECRET -b"$STRIPE_WEBHOOK" -R "$REPO"
fi

echo ""
echo "✅ GitHub Secrets setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Run: ./setup-aws-secrets.sh (to set up AWS Secrets Manager)"
echo "2. ⚠️  ROTATE ALL CREDENTIALS (they were exposed in plain text)"
echo "3. Delete this script or move it to a secure location"
echo "4. Never commit this file to git"
echo ""
echo "🔐 To verify secrets were set:"
echo "   gh secret list -R $REPO"

