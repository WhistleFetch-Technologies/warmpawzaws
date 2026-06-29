#!/bin/bash
# GitHub Secrets Setup - Copy/Paste Commands
# Use these commands to set up secrets via GitHub CLI

# First, install GitHub CLI and authenticate:
# Download from: https://cli.github.com/
# Then run: gh auth login

# AWS Credentials
gh secret set AWS_ACCESS_KEY_ID --body "AKIAQK4TGNEFLQJLXMMI"
gh secret set AWS_SECRET_ACCESS_KEY --body "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"
gh secret set AWS_REGION --body "ap-south-1"
gh secret set AWS_ACCOUNT_ID --body "023394150666"

# Razorpay
gh secret set RAZORPAY_KEY_ID --body "rzp_test_Rnp57suJH3wzUl"
gh secret set RAZORPAY_KEY_SECRET --body "rplcWAxtmVfvXI9uydFt7YkH"

# Google Maps
gh secret set GOOGLE_MAPS_API_KEY --body "AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0"

# Shiprocket
gh secret set SHIPROCKET_EMAIL --body "ketanh@warmpawz.com"
gh secret set SHIPROCKET_PASSWORD --body "znoMnd9FkntmRuXCq\$d@eKfQj1M8oXGj."

# Frontend Keys
gh secret set NEXT_PUBLIC_RAZORPAY_KEY_DEV --body "rzp_test_Rnp57suJH3wzUl"
gh secret set NEXT_PUBLIC_RAZORPAY_KEY_STAGE --body "rzp_test_Rnp57suJH3wzUl"
gh secret set NEXT_PUBLIC_RAZORPAY_KEY_PROD --body "rzp_test_Rnp57suJH3wzUl"

gh secret set NEXT_PUBLIC_API_BASE_URL_DEV --body "https://dev.api.warmpawz.com"
gh secret set NEXT_PUBLIC_API_BASE_URL_STAGE --body "https://stage.api.warmpawz.com"
gh secret set NEXT_PUBLIC_API_BASE_URL_PROD --body "https://api.warmpawz.com"

# Optional: Slack webhook (get from Slack)
# gh secret set SLACK_WEBHOOK_URL --body "YOUR_SLACK_WEBHOOK_URL"

# Optional: Codecov token (get from codecov.io)
# gh secret set CODECOV_TOKEN --body "YOUR_CODECOV_TOKEN"

echo "✅ All GitHub secrets have been set!"
echo ""
echo "⚠️  IMPORTANT: These credentials were exposed in plain text."
echo "    Follow SECURITY_WARNING.md to rotate them immediately after deployment."
echo ""
echo "Next steps:"
echo "1. Verify secrets: gh secret list"
echo "2. Create GitHub environments (see DEPLOY_MANUAL_STEPS.md)"
echo "3. Bootstrap Terraform"
echo "4. Deploy to dev by pushing to 'develop' branch"

