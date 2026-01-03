#!/bin/bash
# AWS Secrets Manager Setup Script
# Sets up runtime secrets for Lambda functions
# ⚠️ WARNING: This file contains sensitive credentials

set -e

AWS_REGION="ap-south-1"

echo "🔐 Setting up AWS Secrets Manager for Warmpawz"
echo "=============================================="
echo ""
echo "Region: $AWS_REGION"
echo ""

# Function to create or update secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2
    
    echo "  📝 Processing: $secret_name"
    
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

# ============================================================================
# DEVELOPMENT ENVIRONMENT
# ============================================================================
echo "Setting up DEV environment secrets..."

# Razorpay
create_or_update_secret \
    "warmpawz/dev/razorpay" \
    '{
        "key_id": "rzp_test_Rnp57suJH3wzUl",
        "key_secret": "rplcWAxtmVfvXI9uydFt7YkH",
        "webhook_secret": "REPLACE_WITH_WEBHOOK_SECRET"
    }'

# Google Maps
create_or_update_secret \
    "warmpawz/dev/google-maps" \
    '{
        "api_key": "AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0"
    }'

# Shiprocket
create_or_update_secret \
    "warmpawz/dev/shiprocket" \
    '{
        "email": "ketanh@warmpawz.com",
        "password": "znoMnd9FkntmRuXCq$d@eKfQj1M8oXGj."
    }'

# Stripe (if you have it)
echo ""
read -p "Do you have Stripe credentials? (y/n): " HAS_STRIPE
if [ "$HAS_STRIPE" == "y" ]; then
    read -p "Enter Stripe Test Secret Key: " STRIPE_SECRET
    read -p "Enter Stripe Test Publishable Key: " STRIPE_PUBLIC
    read -p "Enter Stripe Webhook Secret: " STRIPE_WEBHOOK
    
    create_or_update_secret \
        "warmpawz/dev/stripe" \
        "{
            \"secret_key\": \"$STRIPE_SECRET\",
            \"publishable_key\": \"$STRIPE_PUBLIC\",
            \"webhook_secret\": \"$STRIPE_WEBHOOK\"
        }"
fi

# ============================================================================
# STAGE ENVIRONMENT
# ============================================================================
echo ""
echo "Setting up STAGE environment secrets..."

# Use same test credentials for stage
create_or_update_secret \
    "warmpawz/stage/razorpay" \
    '{
        "key_id": "rzp_test_Rnp57suJH3wzUl",
        "key_secret": "rplcWAxtmVfvXI9uydFt7YkH",
        "webhook_secret": "REPLACE_WITH_WEBHOOK_SECRET"
    }'

create_or_update_secret \
    "warmpawz/stage/google-maps" \
    '{
        "api_key": "AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0"
    }'

create_or_update_secret \
    "warmpawz/stage/shiprocket" \
    '{
        "email": "ketanh@warmpawz.com",
        "password": "znoMnd9FkntmRuXCq$d@eKfQj1M8oXGj."
    }'

if [ "$HAS_STRIPE" == "y" ]; then
    create_or_update_secret \
        "warmpawz/stage/stripe" \
        "{
            \"secret_key\": \"$STRIPE_SECRET\",
            \"publishable_key\": \"$STRIPE_PUBLIC\",
            \"webhook_secret\": \"$STRIPE_WEBHOOK\"
        }"
fi

# ============================================================================
# PRODUCTION ENVIRONMENT
# ============================================================================
echo ""
echo "Setting up PRODUCTION environment secrets..."
echo "⚠️  For production, you should use LIVE credentials"
echo ""

read -p "Do you have Razorpay LIVE credentials? (y/n): " HAS_RAZORPAY_LIVE
if [ "$HAS_RAZORPAY_LIVE" == "y" ]; then
    read -p "Enter Razorpay Live Key ID: " RAZORPAY_LIVE_ID
    read -sp "Enter Razorpay Live Key Secret: " RAZORPAY_LIVE_SECRET
    echo ""
    read -p "Enter Razorpay Live Webhook Secret: " RAZORPAY_LIVE_WEBHOOK
    
    create_or_update_secret \
        "warmpawz/prod/razorpay" \
        "{
            \"key_id\": \"$RAZORPAY_LIVE_ID\",
            \"key_secret\": \"$RAZORPAY_LIVE_SECRET\",
            \"webhook_secret\": \"$RAZORPAY_LIVE_WEBHOOK\"
        }"
else
    echo "⚠️  Using test credentials for production (NOT RECOMMENDED)"
    create_or_update_secret \
        "warmpawz/prod/razorpay" \
        '{
            "key_id": "rzp_test_Rnp57suJH3wzUl",
            "key_secret": "rplcWAxtmVfvXI9uydFt7YkH",
            "webhook_secret": "REPLACE_WITH_WEBHOOK_SECRET"
        }'
fi

# Use same Google Maps key for prod (should get production key)
create_or_update_secret \
    "warmpawz/prod/google-maps" \
    '{
        "api_key": "AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0"
    }'

create_or_update_secret \
    "warmpawz/prod/shiprocket" \
    '{
        "email": "ketanh@warmpawz.com",
        "password": "znoMnd9FkntmRuXCq$d@eKfQj1M8oXGj."
    }'

if [ "$HAS_STRIPE" == "y" ]; then
    read -p "Do you have Stripe LIVE credentials? (y/n): " HAS_STRIPE_LIVE
    if [ "$HAS_STRIPE_LIVE" == "y" ]; then
        read -p "Enter Stripe Live Secret Key: " STRIPE_LIVE_SECRET
        read -p "Enter Stripe Live Publishable Key: " STRIPE_LIVE_PUBLIC
        read -p "Enter Stripe Live Webhook Secret: " STRIPE_LIVE_WEBHOOK
        
        create_or_update_secret \
            "warmpawz/prod/stripe" \
            "{
                \"secret_key\": \"$STRIPE_LIVE_SECRET\",
                \"publishable_key\": \"$STRIPE_LIVE_PUBLIC\",
                \"webhook_secret\": \"$STRIPE_LIVE_WEBHOOK\"
            }"
    else
        echo "⚠️  Using test Stripe credentials for production"
        create_or_update_secret \
            "warmpawz/prod/stripe" \
            "{
                \"secret_key\": \"$STRIPE_SECRET\",
                \"publishable_key\": \"$STRIPE_PUBLIC\",
                \"webhook_secret\": \"$STRIPE_WEBHOOK\"
            }"
    fi
fi

echo ""
echo "✅ AWS Secrets Manager setup complete!"
echo ""
echo "📋 To verify secrets:"
echo "   aws secretsmanager list-secrets --region $AWS_REGION --query 'SecretList[?contains(Name, \`warmpawz\`)].Name'"
echo ""
echo "📋 To retrieve a secret:"
echo "   aws secretsmanager get-secret-value --secret-id warmpawz/dev/razorpay --region $AWS_REGION"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Update Razorpay webhook secrets in the secrets"
echo "2. Get production API keys from respective services"
echo "3. ROTATE all credentials (they were exposed in plain text)"
echo "4. Enable secret rotation in AWS Secrets Manager"
echo "5. Delete this script or move to secure location"

