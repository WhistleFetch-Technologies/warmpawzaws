#!/bin/bash
# Step-by-Step Deployment Guide
# Run this to see what to do next

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Warmpawz Deployment - Step by Step Guide              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Current Status Check:"
echo "━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if GitHub CLI is installed
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI installed"
    if gh auth status &> /dev/null; then
        echo "✅ GitHub authenticated"
    else
        echo "❌ GitHub not authenticated"
        echo "   Run: gh auth login"
    fi
else
    echo "❌ GitHub CLI not installed"
    echo "   Run: brew install gh (Mac) or see https://cli.github.com/"
fi

# Check if AWS CLI is installed
if command -v aws &> /dev/null; then
    echo "✅ AWS CLI installed"
    if aws sts get-caller-identity &> /dev/null 2>&1; then
        echo "✅ AWS configured"
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        echo "   Account: $ACCOUNT_ID"
    else
        echo "❌ AWS not configured"
        echo "   Run: aws configure"
    fi
else
    echo "❌ AWS CLI not installed"
    echo "   Run: brew install awscli (Mac)"
fi

# Check if Terraform is installed
if command -v terraform &> /dev/null; then
    echo "✅ Terraform installed"
    terraform version | head -1
else
    echo "❌ Terraform not installed"
    echo "   Run: brew install terraform (Mac)"
fi

# Check if git repo is initialized
if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "✅ Git repository"
    BRANCH=$(git branch --show-current)
    echo "   Current branch: $BRANCH"
else
    echo "❌ Not a git repository"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                 DEPLOYMENT STEPS                           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 STEP 1: Set up GitHub Secrets"
echo "   Choose ONE method:"
echo ""
echo "   Option A - One Command (Recommended):"
echo "   $ ./scripts/one-command-setup.sh"
echo ""
echo "   Option B - Manual Steps:"
echo "   $ ./scripts/setup-github-secrets.sh"
echo "   $ ./scripts/setup-aws-secrets.sh"
echo ""
echo "   Option C - GitHub Web UI:"
echo "   See: GITHUB_SECRETS_COMPLETE_LIST.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 STEP 2: Bootstrap Terraform State Backend"
echo "   $ cd infra/bootstrap"
echo "   $ terraform init"
echo "   $ terraform apply -var='create_state_backend=true' -var='aws_account_id=YOUR_ACCOUNT_ID'"
echo "   $ cd ../.."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 STEP 3: Deploy to DEV (Automatic)"
echo "   $ git checkout -b develop  # If branch doesn't exist"
echo "   $ git add ."
echo "   $ git commit -m 'feat: initial infrastructure setup'"
echo "   $ git push origin develop"
echo ""
echo "   🔄 This triggers: .github/workflows/dev.yml"
echo "   📊 Monitor: https://github.com/YOUR_USERNAME/warmpawzecodev/actions"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 STEP 4: Deploy to STAGE (Manual Approval)"
echo "   $ git checkout -b main  # If branch doesn't exist"
echo "   $ git merge develop"
echo "   $ git push origin main"
echo ""
echo "   ⚠️  Requires: 1 reviewer approval"
echo "   🔄 This triggers: .github/workflows/stage.yml"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 STEP 5: Deploy to PROD (Strict Approval)"
echo "   Go to: https://github.com/YOUR_USERNAME/warmpawzecodev/actions"
echo "   1. Click 'Deploy to Production' workflow"
echo "   2. Click 'Run workflow'"
echo "   3. Type: DEPLOY_TO_PRODUCTION"
echo "   4. Click 'Run workflow'"
echo ""
echo "   ⚠️  Requires: 2 reviewers approval"
echo "   🔄 This triggers: .github/workflows/prod.yml"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 STEP 6: Post-Deployment (CRITICAL)"
echo "   ⚠️  ROTATE ALL CREDENTIALS:"
echo "   1. AWS access key"
echo "   2. Razorpay API keys"
echo "   3. Restrict Google Maps key"
echo "   4. Change Shiprocket password"
echo ""
echo "   See: SECURITY_WARNING.md for instructions"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔍 VERIFICATION COMMANDS"
echo ""
echo "Check GitHub Secrets:"
echo "$ gh secret list"
echo ""
echo "Check AWS Secrets:"
echo "$ aws secretsmanager list-secrets --region ap-south-1"
echo ""
echo "Check Terraform State:"
echo "$ aws s3 ls | grep terraform-state"
echo ""
echo "Check Deployments:"
echo "$ gh run list --limit 5"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 HELPFUL DOCUMENTS"
echo ""
echo "• QUICK_SETUP_CREDENTIALS.md - Step-by-step setup guide"
echo "• SECURITY_WARNING.md - Credential rotation instructions"
echo "• GITHUB_SECRETS_COMPLETE_LIST.md - All secrets reference"
echo "• docs/DEPLOYMENT_GUIDE.md - Full deployment guide"
echo "• DEPLOYMENT_CHECKLIST.md - Pre-deployment checklist"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Need help? Check:"
echo "• GitHub Actions logs for errors"
echo "• CloudWatch logs for runtime issues"
echo "• docs/DEPLOYMENT_GUIDE.md troubleshooting section"
echo ""
echo "Good luck! 🚀"

