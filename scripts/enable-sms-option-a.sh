#!/usr/bin/env bash
#
# Enable Option A: SMS via DB credentials (all four steps via AWS CLI + seed).
#
# Steps:
#   1. Create IAM user warmpawz-sms-sender (if not exists)
#   2. Attach inline policy allowing SNS:Publish
#   3. Create access key for the user
#   4. Seed platform_settings (admin:settings:aws) with credentials + SNS enabled
#
# Usage:
#   ENVIRONMENT=prod ./scripts/enable-sms-option-a.sh
#   ENVIRONMENT=prod AWS_REGION=ap-south-1 ./scripts/enable-sms-option-a.sh
#
# Prerequisites:
#   - AWS CLI configured with credentials that can create IAM users and read RDS/Secrets Manager
#   - Node.js and node in PATH (for step 4 seed script)
#   - RDS cluster warmpawz-{ENVIRONMENT}-cluster and Secrets Manager secret for DB password
#
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
USER_NAME="warmpawz-sms-sender"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=============================================="
echo "  Enable Option A: SMS via DB credentials"
echo "  Environment: $ENVIRONMENT | Region: $REGION"
echo "=============================================="
echo ""

# ---------------------------------------------------------------------------
# Step 1: Create IAM user (idempotent)
# ---------------------------------------------------------------------------
echo "[Step 1/4] Create IAM user: $USER_NAME"
if aws iam get-user --user-name "$USER_NAME" --region "$REGION" 2>/dev/null; then
  echo "  -> User $USER_NAME already exists, skipping create."
else
  aws iam create-user --user-name "$USER_NAME" --region "$REGION"
  echo "  -> User $USER_NAME created."
fi
echo ""

# ---------------------------------------------------------------------------
# Step 2: Attach inline policy for SNS:Publish
# ---------------------------------------------------------------------------
echo "[Step 2/4] Attach SNS:Publish policy to $USER_NAME"
POLICY_DOC='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "*"
    }
  ]
}'
aws iam put-user-policy \
  --user-name "$USER_NAME" \
  --policy-name "SNS-Publish-SMS" \
  --policy-document "$POLICY_DOC" \
  --region "$REGION"
echo "  -> Policy SNS-Publish-SMS attached."
echo ""

# ---------------------------------------------------------------------------
# Step 3: Create access key (or use existing from env)
# ---------------------------------------------------------------------------
if [[ -n "${SMS_AWS_ACCESS_KEY_ID:-}" && -n "${SMS_AWS_SECRET_ACCESS_KEY:-}" ]]; then
  echo "[Step 3/4] Use existing credentials from env (SMS_AWS_ACCESS_KEY_ID / SMS_AWS_SECRET_ACCESS_KEY)"
  ACCESS_KEY_ID="$SMS_AWS_ACCESS_KEY_ID"
  SECRET_ACCESS_KEY="$SMS_AWS_SECRET_ACCESS_KEY"
  echo "  -> Using provided keys (AccessKeyId: ${ACCESS_KEY_ID:0:8}...)."
else
  echo "[Step 3/4] Create access key for $USER_NAME"
  KEY_OUTPUT="$(aws iam create-access-key --user-name "$USER_NAME" --region "$REGION" --output json)"
  ACCESS_KEY_ID="$(echo "$KEY_OUTPUT" | jq -r '.AccessKey.AccessKeyId')"
  SECRET_ACCESS_KEY="$(echo "$KEY_OUTPUT" | jq -r '.AccessKey.SecretAccessKey')"
  if [[ -z "$ACCESS_KEY_ID" || -z "$SECRET_ACCESS_KEY" || "$ACCESS_KEY_ID" == "null" || "$SECRET_ACCESS_KEY" == "null" ]]; then
    echo "  -> ERROR: Failed to create or parse access key. If user already has 2 keys, run: aws iam list-access-keys --user-name $USER_NAME, then delete one and retry."
    exit 1
  fi
  echo "  -> Access key created (AccessKeyId: ${ACCESS_KEY_ID:0:8}...). Save SecretAccessKey; it is not shown again."
fi
echo ""

# ---------------------------------------------------------------------------
# Step 4: Seed admin:settings:aws in RDS (SNS enabled + credentials)
# ---------------------------------------------------------------------------
echo "[Step 4/4] Seed platform_settings (admin:settings:aws) with SNS enabled"
export ENVIRONMENT
export AWS_REGION="$REGION"
export SMS_AWS_ACCESS_KEY_ID="$ACCESS_KEY_ID"
export SMS_AWS_SECRET_ACCESS_KEY="$SECRET_ACCESS_KEY"
# Optional: override DB secret ID if prod uses a different one
# export SMS_DB_SECRET_ID="warmpawz-prod-rds-master-XXXXXXXX"

cd "$REPO_ROOT"
if ! command -v node >/dev/null 2>&1; then
  echo "  -> ERROR: node not found. Install Node.js and re-run, or run step 4 manually:"
  echo "     ENVIRONMENT=$ENVIRONMENT SMS_AWS_ACCESS_KEY_ID=$ACCESS_KEY_ID SMS_AWS_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY node scripts/seed-sms-aws-settings.js --enable"
  exit 1
fi
node scripts/seed-sms-aws-settings.js --enable
echo ""

echo "=============================================="
echo "  Option A enabled. SMS will use DB credentials."
echo "  Store the SecretAccessKey securely; it is not shown again."
echo "=============================================="
