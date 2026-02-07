#!/usr/bin/env bash
#
# Create AWS Support cases via CLI for:
# 1. SNS SMS monthly spend limit increase (10000 SMS/month)
# 2. India Sender ID preregistration (link DLT Entity ID + Template IDs)
#
# Requires: Premium Support (Business/Enterprise). Without it, run with --print to get manual copy-paste content.
#
# Usage:
#   ./scripts/aws-sms-support-cases.sh           # Create cases via CLI (Premium Support)
#   ./scripts/aws-sms-support-cases.sh --print   # Print content for manual submission
#

set -e
REGION="${AWS_REGION:-ap-south-1}"
SPEND_LIMIT_USD="${SMS_SPEND_LIMIT_USD:-300}"   # ~10000 SMS
PRINT_ONLY="${PRINT_ONLY:-false}"
[[ "$1" == "--print" ]] && PRINT_ONLY=true

create_cases() {
  echo "[1/2] Creating SNS spend limit increase case..."
  CASE1=$(aws support create-case \
    --subject "SNS Text Messaging - Account Spend Threshold Increase to \$${SPEND_LIMIT_USD} for 10000 SMS/month" \
    --service-code "service-limit-increase" \
    --severity-code "normal" \
    --category-code "service-code-sns-text-messaging" \
    --communication-body "Use case: Warmpawz pet care platform sends transactional SMS to customers in India:
- Login OTP (one-time passwords)
- Booking confirmations, reschedules, cancellations

Website: https://warmpawz.com
Message type: Transactional + One Time Password
Region: ap-south-1 (Mumbai)
Country: India
Opt-in: Users provide phone during registration; SMS only for account security and booking updates.

REQUEST: Account Spend Threshold Increase
- Limit type: SNS Text Messaging
- Region: ap-south-1
- Resource Type: General Limits
- Limit: Account Spend Threshold Increase
- New limit value (USD): ${SPEND_LIMIT_USD}

Estimated volume: 10000 SMS per month." \
    --language en \
    --output json 2>&1) || { echo "Failed (Premium Support required?). Use --print for manual content."; return 1; }
  ID1=$(echo "$CASE1" | jq -r '.caseId')
  echo "  Created: $ID1"

  echo "[2/2] Creating India Sender ID preregistration case..."
  CASE2=$(aws support create-case \
    --subject "India Sender ID Preregistration - Link DLT Entity ID and Template IDs to AWS Account" \
    --service-code "amazon-simple-notification-service" \
    --severity-code "normal" \
    --category-code "sms-general" \
    --communication-body "Request: Preregister India sender ID and link DLT (TRAI) Entity ID and Template IDs to this AWS account for local route SMS delivery.

We have completed DLT registration via Jio True Connect (TRAI-approved). Please associate the following with our account:

ENTITY ID (Principal Entity / PE): 1201176605406673276
SENDER ID: WARMPZ
REGION: ap-south-1

TEMPLATE IDs (from Jio True Connect):
- Login OTP: 1207177028377787269
  Message: Warmpawz: Your OTP for logging in is {#number#}. Do not share this OTP with anyone.
- Booking Confirmation: 1207177035174777582
- Booking Rescheduled: 1207177035515118051
- Booking Cancelled: 1207177035326314961

Use case: Pet care platform - transactional OTP and booking notifications to customers in India.
Website: https://warmpawz.com" \
    --language en \
    --output json 2>&1) || { echo "Failed."; return 1; }
  ID2=$(echo "$CASE2" | jq -r '.caseId')
  echo "  Created: $ID2"

  echo ""
  echo "After spend limit approval, run:"
  echo "  aws sns set-sms-attributes --region $REGION --attributes MonthlySpendLimit=$SPEND_LIMIT_USD"
}

if [[ "$PRINT_ONLY" == "true" ]]; then
  echo "=============================================="
  echo "AWS Support Cases - Manual Submission Content"
  echo "=============================================="
  echo "Submit at: https://console.aws.amazon.com/support/home#/case/create"
  echo ""
fi

if [[ "$PRINT_ONLY" != "true" ]]; then
  create_cases
  exit 0
fi

echo "=============================================="
echo "CASE 1: SNS SMS Monthly Spend Limit Increase"
echo "=============================================="
echo ""
echo "Limit type: SNS Text Messaging"
echo "Region: $REGION (ap-south-1)"
echo "Resource Type: General Limits"
echo "Limit: Account Spend Threshold Increase"
echo "New limit value (USD): $SPEND_LIMIT_USD"
echo ""
echo "Case description (copy):"
echo "---"
cat << 'CASE1'
Use case: Warmpawz pet care platform sends transactional SMS to customers in India:
- Login OTP (one-time passwords)
- Booking confirmations, reschedules, cancellations

Website: https://warmpawz.com
Message type: Transactional + One Time Password
Region: ap-south-1 (Mumbai)
Country: India
Opt-in: Users provide phone during registration; SMS only for account security and booking updates.
CASE1
echo "---"
echo ""

echo "=============================================="
echo "CASE 2: India Sender ID Preregistration (DLT)"
echo "=============================================="
echo ""
echo "Limit type: SNS Text Messaging (or General inquiry if not available)"
echo ""
echo "Case description (copy):"
echo "---"
cat << CASE2
Request: Preregister India sender ID and link DLT (TRAI) Entity ID and Template IDs to this AWS account for local route SMS delivery.

We have completed DLT registration via Jio True Connect (TRAI-approved). Please associate the following with our account:

ENTITY ID (Principal Entity / PE): 1201176605406673276
SENDER ID: WARMPZ
REGION: ap-south-1

TEMPLATE IDs (from Jio True Connect):
- Login OTP: 1207177028377787269
  Message: "Warmpawz: Your OTP for logging in is {#number#}. Do not share this OTP with anyone."
- Booking Confirmation: 1207177035174777582
- Booking Rescheduled: 1207177035515118051
- Booking Cancelled: 1207177035326314961

Use case: Pet care platform - transactional OTP and booking notifications to customers in India.
Website: https://warmpawz.com
CASE2
echo "---"
echo ""

echo "=============================================="
echo "AFTER APPROVAL: Set Spend Limit via CLI"
echo "=============================================="
echo ""
echo "After AWS Support approves the spend limit increase, run:"
echo ""
echo "  aws sns set-sms-attributes --region $REGION --attributes MonthlySpendLimit=$SPEND_LIMIT_USD"
echo ""
echo "Or with custom limit:"
echo "  SMS_SPEND_LIMIT_USD=500 ./scripts/aws-sms-support-cases.sh"
echo ""
