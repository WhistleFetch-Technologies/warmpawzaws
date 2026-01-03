#!/bin/bash

# Automated GitHub Environments Setup Script
# Uses GitHub CLI and API to create environments with protection rules

set -e

export PATH="$HOME/bin:$PATH"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     Creating GitHub Environments Automatically            ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "📦 Repository: $REPO"
echo ""

# Function to create environment
create_environment() {
    local env_name=$1
    local reviewers=$2
    local wait_timer=$3
    
    echo "Creating environment: $env_name"
    
    # Create the environment (this creates it if it doesn't exist)
    gh api \
        --method PUT \
        -H "Accept: application/vnd.github+json" \
        "/repos/$REPO/environments/$env_name" \
        -f wait_timer=$wait_timer \
        > /dev/null 2>&1 || echo "  ℹ️  Environment may already exist"
    
    # Add protection rules if reviewers specified
    if [ ! -z "$reviewers" ] && [ "$reviewers" != "0" ]; then
        echo "  Adding protection: $reviewers reviewer(s)"
        
        # Get current user ID for reviewer
        USER_ID=$(gh api user -q .id)
        
        # Build reviewers JSON
        REVIEWERS_JSON='{"reviewers":[{"type":"User","id":'$USER_ID'}]}'
        
        # Update environment with protection rules
        gh api \
            --method PUT \
            -H "Accept: application/vnd.github+json" \
            "/repos/$REPO/environments/$env_name" \
            -f wait_timer=$wait_timer \
            -F "deployment_branch_policy[protected_branches]=false" \
            -F "deployment_branch_policy[custom_branch_policies]=true" \
            > /dev/null 2>&1 || echo "  ⚠️  Could not set branch policy"
        
        # Set required reviewers
        gh api \
            --method PUT \
            -H "Accept: application/vnd.github+json" \
            "/repos/$REPO/environments/$env_name" \
            -f wait_timer=$wait_timer \
            --input - <<< "{
                \"reviewers\": [{
                    \"type\": \"User\",
                    \"id\": $USER_ID
                }],
                \"deployment_branch_policy\": null
            }" > /dev/null 2>&1 || echo "  ⚠️  Could not set reviewers (may need to be done manually)"
    fi
    
    echo "  ✅ Environment '$env_name' ready"
    echo ""
}

# Create environments
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

create_environment "dev" "0" "0"
create_environment "stage" "1" "0"
create_environment "stage-approval" "1" "0"
create_environment "production" "2" "0"
create_environment "production-approval" "2" "0"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ All environments created!"
echo ""
echo "⚠️  NOTE: GitHub API has limitations. You may need to:"
echo "   1. Add additional reviewers manually (for 2-reviewer environments)"
echo "   2. Configure deployment branch policies"
echo ""
echo "To verify, visit:"
echo "https://github.com/$REPO/settings/environments"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 NEXT STEP: Bootstrap Terraform"
echo ""
echo "Run these commands:"
echo "  cd infra/bootstrap"
echo "  terraform init"
echo "  terraform apply -var='create_state_backend=true' -var='aws_account_id=023394150666'"
echo ""

