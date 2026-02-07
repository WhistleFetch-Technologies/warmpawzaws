#!/bin/bash
# Script to set up secrets in AWS Secrets Manager

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}

echo "🔐 Setting up secrets in AWS Secrets Manager for $ENVIRONMENT environment..."

# Function to create or update secret
create_or_update_secret() {
  local secret_name=$1
  local secret_value=$2
  
  echo "  Processing: $secret_name"
  
  # Try to create the secret
  if aws secretsmanager create-secret \
    --name "$secret_name" \
    --secret-string "$secret_value" \
    --region "$AWS_REGION" \
    2>/dev/null; then
    echo "  ✅ Created: $secret_name"
  else
    # If it exists, update it
    aws secretsmanager put-secret-value \
      --secret-id "$secret_name" \
      --secret-string "$secret_value" \
      --region "$AWS_REGION" \
      2>/dev/null && echo "  ✅ Updated: $secret_name" || echo "  ⚠️  Failed: $secret_name"
  fi
}

# Razorpay
echo "Setting up Razorpay secrets..."
read -p "Enter Razorpay Key ID: " RAZORPAY_KEY_ID
read -sp "Enter Razorpay Key Secret: " RAZORPAY_KEY_SECRET
echo ""

create_or_update_secret \
  "warmpawz/${ENVIRONMENT}/razorpay" \
  "{\"key_id\":\"${RAZORPAY_KEY_ID}\",\"key_secret\":\"${RAZORPAY_KEY_SECRET}\"}"

# Stripe
echo "Setting up Stripe secrets..."
read -p "Enter Stripe Secret Key: " STRIPE_SECRET_KEY
read -p "Enter Stripe Publishable Key: " STRIPE_PUBLISHABLE_KEY
echo ""

create_or_update_secret \
  "warmpawz/${ENVIRONMENT}/stripe" \
  "{\"secret_key\":\"${STRIPE_SECRET_KEY}\",\"publishable_key\":\"${STRIPE_PUBLISHABLE_KEY}\"}"

# Shiprocket
echo "Setting up Shiprocket secrets..."
read -p "Enter Shiprocket Email: " SHIPROCKET_EMAIL
read -sp "Enter Shiprocket Password: " SHIPROCKET_PASSWORD
echo ""

create_or_update_secret \
  "warmpawz/${ENVIRONMENT}/shiprocket" \
  "{\"email\":\"${SHIPROCKET_EMAIL}\",\"password\":\"${SHIPROCKET_PASSWORD}\"}"

# Google Maps
echo "Setting up Google Maps API key..."
read -p "Enter Google Maps API Key: " GOOGLE_MAPS_API_KEY
echo ""

create_or_update_secret \
  "warmpawz/${ENVIRONMENT}/google-maps" \
  "{\"api_key\":\"${GOOGLE_MAPS_API_KEY}\"}"

echo ""
echo "✅ All secrets have been set up successfully!"
echo ""
echo "To retrieve secrets:"
echo "  aws secretsmanager get-secret-value --secret-id warmpawz/${ENVIRONMENT}/razorpay --region ${AWS_REGION}"

