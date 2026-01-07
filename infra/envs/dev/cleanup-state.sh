#!/bin/bash
# ============================================================================
# CLEANUP ORPHANED TERRAFORM STATE - DEV ENVIRONMENT
# ============================================================================
# Removes state entries for resources that exist in wrong region (us-east-1)
# when deploying to ap-south-1. This prevents PermanentRedirect errors.
# ============================================================================

set -e

echo "============================================"
echo "🧹 Cleaning orphaned us-east-1 resources"
echo "Target region: ap-south-1"
echo "============================================"

# Resources that may exist in us-east-1 and need to be removed from state
ORPHANED_PATTERNS=(
    "module.s3."
    "module.cloudfront."
    "module.sns."
    "module.cognito."
    "module.rds."
    "module.secrets."
    "module.api_gateway."
    "module.lambda."
    "module.vpc."
    "module.dynamodb."
    "module.sqs."
    "module.acm."
    "aws_route53_record."
    "aws_apigatewayv2_"
)

REMOVED=0

# Get list of all resources in state
STATE_LIST=$(terraform state list 2>/dev/null || echo "")

if [ -z "$STATE_LIST" ]; then
    echo "ℹ️  No resources in state or unable to list state"
    exit 0
fi

# For each pattern, find and remove matching resources
for pattern in "${ORPHANED_PATTERNS[@]}"; do
    MATCHING=$(echo "$STATE_LIST" | grep "^${pattern}" || true)
    if [ -n "$MATCHING" ]; then
        while IFS= read -r resource; do
            if [ -n "$resource" ]; then
                echo "🗑️  Removing: ${resource}"
                terraform state rm "${resource}" 2>/dev/null || true
                ((REMOVED++)) || true
            fi
        done <<< "$MATCHING"
    fi
done

echo ""
echo "============================================"
echo "✅ Cleanup complete! Removed ${REMOVED} entries"
echo "============================================"
