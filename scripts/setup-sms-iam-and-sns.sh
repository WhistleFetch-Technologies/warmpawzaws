#!/usr/bin/env bash
#
# Setup IAM user and SNS for SMS sending (Login OTP, booking notifications)
#
# Creates:
# - IAM user warmpawz-sms-sender
# - Access key for SNS Publish
# - SNS SMS preferences (Transactional, sender ID WARMPZ)
#
# Usage:
#   ./scripts/setup-sms-iam-and-sns.sh
#   AWS_PROFILE=prod ./scripts/setup-sms-iam-and-sns.sh
#
# After running: use the AccessKeyId and SecretAccessKey with seed-sms-aws-settings.js
#

set -e
REGION="${AWS_REGION:-ap-south-1}"
USER_NAME="warmpawz-sms-sender"
POLICY_NAME="warmpawz-sms-sns-policy"

echo "=== Setup SMS IAM and SNS ==="
echo "Region: $REGION"
echo ""

# Create IAM user (idempotent)
echo "[1/4] Creating IAM user: $USER_NAME"
aws iam create-user --user-name "$USER_NAME" 2>/dev/null || echo "  (user may already exist)"
echo ""

# Inline policy for SNS Publish
echo "[2/4] Attaching SNS publish policy"
POLICY_DOC='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sns:Publish", "sns:GetSMSAttributes", "sns:SetSMSAttributes"],
      "Resource": "*"
    }
  ]
}'
aws iam put-user-policy \
  --user-name "$USER_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "$POLICY_DOC"
echo "  Policy attached."
echo ""

# Create access key (prints warning if keys exist)
echo "[3/4] Creating access key"
KEYS=$(aws iam create-access-key --user-name "$USER_NAME" 2>&1) || true
if echo "$KEYS" | grep -q "LimitExceeded"; then
  echo "  Access key limit reached. List existing keys:"
  aws iam list-access-keys --user-name "$USER_NAME"
  echo ""
  echo "  Use an existing key or delete one with:"
  echo "  aws iam delete-access-key --user-name $USER_NAME --access-key-id <ID>"
  echo ""
  echo "  Then run: ENVIRONMENT=dev SMS_AWS_ACCESS_KEY_ID=<key> SMS_AWS_SECRET_ACCESS_KEY=<secret> node scripts/seed-sms-aws-settings.js --enable"
else
  ACCESS_KEY=$(echo "$KEYS" | grep -o '"AccessKeyId": "[^"]*"' | cut -d'"' -f4)
  SECRET_KEY=$(echo "$KEYS" | grep -o '"SecretAccessKey": "[^"]*"' | cut -d'"' -f4)
  echo "  AccessKeyId: $ACCESS_KEY"
  echo "  SecretAccessKey: $SECRET_KEY"
  echo ""
  echo "  Run seed script:"
  echo "  ENVIRONMENT=dev SMS_AWS_ACCESS_KEY_ID=$ACCESS_KEY SMS_AWS_SECRET_ACCESS_KEY=$SECRET_KEY node scripts/seed-sms-aws-settings.js --enable"
fi
echo ""

# Set SNS SMS attributes (Transactional, default sender ID WARMPZ)
echo "[4/5] Setting SNS SMS attributes"
aws sns set-sms-attributes \
  --attributes "DefaultSMSType=Transactional,DefaultSenderID=WARMPZ" \
  --region "$REGION" 2>/dev/null || echo "  (SMS attributes may require account-level config)"
echo "  Done."
echo ""

# Verify SNS attributes
echo "[5/5] Verifying SNS SMS attributes"
aws sns get-sms-attributes --region "$REGION" --output table 2>/dev/null || true
echo ""

echo "=== Done ==="
echo ""
echo "India DLT (Jio True Connect):"
echo "  Entity ID (PE): 1201176605406673276"
echo "  Login OTP Template ID: 1207177028377787269"
echo "  Header: WARMPZ"
echo ""
echo "REQUIRED for India local routes:"
echo "  1. Preregister sender ID with AWS: https://docs.aws.amazon.com/sns/latest/dg/channels-sms-senderid-india.html#sns-india-request-sender-id"
echo "  2. Request SMS spend limit increase (if MonthlySpendLimit=1): AWS Support -> SNS Limit Increase"
echo ""
echo "Next: ENVIRONMENT=dev SMS_AWS_ACCESS_KEY_ID=xxx SMS_AWS_SECRET_ACCESS_KEY=yyy node scripts/seed-sms-aws-settings.js --enable"
echo "Test: node scripts/test-sms-send.js 9611377119"
