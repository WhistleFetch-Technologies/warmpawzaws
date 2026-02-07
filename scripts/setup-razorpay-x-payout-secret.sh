#!/usr/bin/env bash
# ============================================================================
# SETUP RAZORPAY X PAYOUT SOURCE ACCOUNT IN AWS SECRETS MANAGER
# ============================================================================
# Merges razorpayXAccountNumber (and optional metadata) into existing
# warmpawz/{stage}/razorpay secret. Run from repo root.
#
# Usage:
#   STAGE=dev ./scripts/setup-razorpay-x-payout-secret.sh 925020033295934
#   # Or with optional metadata (for your records only; Lambda uses only account number):
#   STAGE=dev ./scripts/setup-razorpay-x-payout-secret.sh 925020033295934 "Whistlefetch Technologies Private Limited" "Axis Bank" "Southend Road, Jayanagar, Bangalore"
#
# Requires: AWS CLI, jq
# ============================================================================

set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
STAGE="${STAGE:-dev}"
SECRET_NAME="warmpawz/${STAGE}/razorpay"

ACCOUNT_NUMBER="${1:-}"
ACCOUNT_HOLDER_NAME="${2:-}"
BANK_NAME="${3:-}"
BRANCH_NAME="${4:-}"

if [ -z "$ACCOUNT_NUMBER" ]; then
  echo "Usage: STAGE=dev $0 <razorpay_x_account_number> [account_holder_name] [bank_name] [branch_name]"
  echo "Example: STAGE=dev $0 925020033295934"
  echo "Example: STAGE=dev $0 925020033295934 'Whistlefetch Technologies Private Limited' 'Axis Bank' 'Southend Road, Jayanagar, Bangalore'"
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required. Install with: brew install jq (macOS) or apt-get install jq (Linux)"
  exit 1
fi

echo "Secret: $SECRET_NAME (region: $REGION)"
echo "Account number (payout source): $ACCOUNT_NUMBER"

# Get current secret value
CURRENT=$(aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --region "$REGION" --query SecretString --output text 2>/dev/null || echo "{}")
if [ "$CURRENT" = "{}" ]; then
  echo "Warning: Secret not found or empty. You must create it first with keyId, keySecret (e.g. via Terraform or Console)."
  echo "Creating a minimal secret with only razorpayXAccountNumber (payouts will work only after you add keyId/keySecret)."
  CURRENT="{}"
fi

# Parse and merge: ensure camelCase keys for Lambda, add RazorpayX account
NEW_JSON=$(echo "$CURRENT" | jq --arg an "$ACCOUNT_NUMBER" \
  --arg name "${ACCOUNT_HOLDER_NAME:-}" \
  --arg bank "${BANK_NAME:-}" \
  --arg branch "${BRANCH_NAME:-}" \
  '
    .razorpayXAccountNumber = $an |
    .xAccountNumber = $an |
    (if .key_id then .keyId = .key_id else . end) |
    (if .key_secret then .keySecret = .key_secret else . end) |
    (if $name != "" then .razorpayXAccountHolderName = $name else . end) |
    (if $bank != "" then .razorpayXBankName = $bank else . end) |
    (if $branch != "" then .razorpayXBranchName = $branch else . end)
  ')

aws secretsmanager put-secret-value \
  --secret-id "$SECRET_NAME" \
  --region "$REGION" \
  --secret-string "$NEW_JSON"

echo "Done. Razorpay secret updated with razorpayXAccountNumber. Lambda will use it on next payout (no deploy needed)."
echo "Reminder: Add your Lambda outbound IP(s) to RazorpayX Dashboard → My Account & Settings → Developer Controls → Share IP Addresses."
