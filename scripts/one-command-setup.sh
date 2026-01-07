#!/bin/bash
# One-Command Setup - Run this to set up everything
# ⚠️ WARNING: Contains sensitive credentials - delete after use

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Warmpawz Secrets Setup - One Command              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "⚠️  SECURITY WARNING:"
echo "This script contains exposed credentials."
echo "After running, you MUST rotate all credentials immediately!"
echo ""
read -p "Press ENTER to continue or Ctrl+C to cancel..."
echo ""

# Step 1: Update .gitignore
echo "📝 Step 1/6: Updating .gitignore..."
cat >> .gitignore << 'EOF'

# Secrets and Credentials (SECURITY)
scripts/setup-github-secrets.sh
scripts/setup-aws-secrets.sh
scripts/one-command-setup.sh
SECURITY_WARNING.md
QUICK_SETUP_CREDENTIALS.md
.gitignore.security
EOF
echo "✅ .gitignore updated"

# Step 2: Make scripts executable
echo ""
echo "📝 Step 2/6: Making scripts executable..."
chmod +x scripts/setup-github-secrets.sh
chmod +x scripts/setup-aws-secrets.sh
echo "✅ Scripts are executable"

# Step 3: Check prerequisites
echo ""
echo "📝 Step 3/6: Checking prerequisites..."

if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not found. Installing..."
    if command -v brew &> /dev/null; then
        brew install gh
    else
        echo "Please install GitHub CLI manually: https://cli.github.com/"
        exit 1
    fi
fi
echo "✅ GitHub CLI found"

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Installing..."
    if command -v brew &> /dev/null; then
        brew install awscli
    else
        echo "Please install AWS CLI manually: https://aws.amazon.com/cli/"
        exit 1
    fi
fi
echo "✅ AWS CLI found"

if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform not found. Installing..."
    if command -v brew &> /dev/null; then
        brew tap hashicorp/tap
        brew install hashicorp/tap/terraform
    else
        echo "Please install Terraform manually: https://www.terraform.io/downloads"
        exit 1
    fi
fi
echo "✅ Terraform found"

# Step 4: Authenticate
echo ""
echo "📝 Step 4/6: Authentication..."

if ! gh auth status &> /dev/null; then
    echo "🔑 Authenticating with GitHub..."
    gh auth login
fi
echo "✅ GitHub authenticated"

if ! aws sts get-caller-identity &> /dev/null; then
    echo "🔑 Configuring AWS..."
    aws configure set aws_access_key_id AKIAQK4TGNEFLQJLXMMI
    aws configure set aws_secret_access_key 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
    aws configure set region ap-south-1
    aws configure set output json
fi
echo "✅ AWS configured"

# Step 5: Run GitHub Secrets Setup
echo ""
echo "📝 Step 5/6: Setting up GitHub Secrets..."
./scripts/setup-github-secrets.sh

# Step 6: Run AWS Secrets Manager Setup
echo ""
echo "📝 Step 6/6: Setting up AWS Secrets Manager..."
./scripts/setup-aws-secrets.sh

# Final Summary
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  ✅ Setup Complete!                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 What was set up:"
echo "   ✅ GitHub Secrets (AWS, Razorpay, Google Maps, Shiprocket)"
echo "   ✅ AWS Secrets Manager (dev, stage, prod)"
echo "   ✅ .gitignore updated"
echo ""
echo "⚠️  CRITICAL NEXT STEPS (DO IMMEDIATELY):"
echo ""
echo "1. 🔄 ROTATE ALL CREDENTIALS:"
echo "   - AWS access key"
echo "   - Razorpay API keys"
echo "   - Shiprocket password"
echo "   - Restrict Google Maps API key"
echo ""
echo "2. 🗑️  DELETE THIS FILE:"
echo "   rm scripts/one-command-setup.sh"
echo ""
echo "3. 📚 READ THE SECURITY WARNING:"
echo "   cat SECURITY_WARNING.md"
echo ""
echo "4. 🚀 START DEPLOYMENT:"
echo "   cd infra/envs/dev"
echo "   terraform init -backend-config=backend.hcl"
echo "   terraform apply"
echo ""
echo "5. 📖 FOLLOW THE GUIDE:"
echo "   cat QUICK_SETUP_CREDENTIALS.md"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Press ENTER to see credential rotation instructions..."
read

cat << 'ROTATION'

╔═══════════════════════════════════════════════════════════════╗
║          CREDENTIAL ROTATION INSTRUCTIONS                     ║
╚═══════════════════════════════════════════════════════════════╝

🔄 AWS ACCESS KEY ROTATION:
──────────────────────────
1. Create new key:
   aws iam create-access-key --user-name YOUR_USERNAME

2. Update GitHub:
   gh secret set AWS_ACCESS_KEY_ID -b"NEW_KEY_ID"
   gh secret set AWS_SECRET_ACCESS_KEY -b"NEW_SECRET"

3. Update local:
   aws configure set aws_access_key_id NEW_KEY_ID
   aws configure set aws_secret_access_key NEW_SECRET

4. Deactivate old key:
   aws iam update-access-key \
     --access-key-id AKIAQK4TGNEFLQJLXMMI \
     --status Inactive

🔄 RAZORPAY KEY ROTATION:
──────────────────────────
1. Login: https://dashboard.razorpay.com/app/keys
2. Click "Regenerate Test Key"
3. Copy new keys
4. Update GitHub:
   gh secret set RAZORPAY_KEY_ID -b"NEW_KEY_ID"
   gh secret set RAZORPAY_KEY_SECRET -b"NEW_SECRET"
5. Update AWS Secrets Manager:
   ./scripts/setup-aws-secrets.sh

🔄 GOOGLE MAPS RESTRICTION:
──────────────────────────
1. Login: https://console.cloud.google.com/apis/credentials
2. Select API key: AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0
3. Click "Restrict Key"
4. API restrictions:
   ☑ Maps JavaScript API
   ☑ Places API
   ☑ Geocoding API
   ☑ Directions API
5. Application restrictions:
   • HTTP referrers: *.warmpawz.com/*
6. Save

🔄 SHIPROCKET PASSWORD CHANGE:
──────────────────────────────
1. Login: https://app.shiprocket.in/
2. Settings → Change Password
3. Generate strong password (20+ chars)
4. Update GitHub:
   gh secret set SHIPROCKET_PASSWORD -b"NEW_PASSWORD"
5. Update AWS Secrets Manager:
   ./scripts/setup-aws-secrets.sh

═══════════════════════════════════════════════════════════════

All rotations complete? Delete sensitive files:
rm -f scripts/setup-github-secrets.sh
rm -f scripts/setup-aws-secrets.sh
rm -f scripts/one-command-setup.sh
rm -f SECURITY_WARNING.md

Good luck with your deployment! 🚀

ROTATION

echo ""
echo "═══════════════════════════════════════════════════════════"

