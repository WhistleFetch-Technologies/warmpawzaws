# GitHub Secrets Configuration Guide

This document lists all the secrets that need to be configured in GitHub for the CI/CD pipelines.

## Required GitHub Secrets

### AWS Credentials (All Environments)
```
AWS_ACCESS_KEY_ID          # AWS access key for deployment
AWS_SECRET_ACCESS_KEY      # AWS secret key for deployment
AWS_REGION                 # AWS region (default: us-east-1)
AWS_ACCOUNT_ID             # Your AWS account ID
```

### Environment-Specific Secrets

#### Development
```
# (no environment-specific secrets beyond shared AWS/integration keys)
```

#### Stage
```
# (no environment-specific secrets beyond shared AWS/integration keys)
```

#### Production
```
# (no environment-specific secrets beyond shared AWS/integration keys)
```

### External Integrations

#### Razorpay
```
RAZORPAY_KEY_ID            # Razorpay API key ID
RAZORPAY_KEY_SECRET        # Razorpay API secret
```

#### Stripe
```
STRIPE_SECRET_KEY          # Stripe secret key
STRIPE_PUBLISHABLE_KEY     # Stripe publishable key
```

#### Shiprocket
```
SHIPROCKET_EMAIL           # Shiprocket account email
SHIPROCKET_PASSWORD        # Shiprocket account password
```

#### Google Maps
```
GOOGLE_MAPS_API_KEY        # Google Maps API key
```

#### Borzo
```
BORZO_API_KEY              # Borzo API key
BORZO_API_SECRET           # Borzo API secret
```

### Notifications
```
SLACK_WEBHOOK_URL          # Slack webhook for deployment notifications
```

### Code Coverage
```
CODECOV_TOKEN              # Codecov.io token for coverage reports
```

## AWS Secrets Manager Setup

The following secrets should be stored in AWS Secrets Manager for runtime use:

### Database Credentials
Automatically created by Terraform:
- `warmpawz-dev-rds-master`
- `warmpawz-stage-rds-master`
- `warmpawz-prod-rds-master`

### External API Keys
Create these manually in AWS Secrets Manager:

```bash
# Razorpay
aws secretsmanager create-secret \
  --name warmpawz/prod/razorpay \
  --secret-string '{
    "key_id": "YOUR_KEY_ID",
    "key_secret": "YOUR_KEY_SECRET"
  }'

# Stripe
aws secretsmanager create-secret \
  --name warmpawz/prod/stripe \
  --secret-string '{
    "secret_key": "YOUR_SECRET_KEY",
    "publishable_key": "YOUR_PUBLISHABLE_KEY"
  }'

# Shiprocket
aws secretsmanager create-secret \
  --name warmpawz/prod/shiprocket \
  --secret-string '{
    "email": "YOUR_EMAIL",
    "password": "YOUR_PASSWORD"
  }'

# Google Maps
aws secretsmanager create-secret \
  --name warmpawz/prod/google-maps \
  --secret-string '{
    "api_key": "YOUR_API_KEY"
  }'
```

## Environment Variables

### Lambda Environment Variables
Set these in the Terraform configuration:

```hcl
common_env_vars = {
  NODE_ENV                    = "production"
  LOG_LEVEL                   = "info"
  DB_HOST                     = module.rds.cluster_endpoint
  DB_NAME                     = "warmpawz"
  COGNITO_USER_POOL_ID        = module.cognito.user_pool_id
  COGNITO_CLIENT_ID           = module.cognito.customer_web_client_id
  S3_UPLOADS_BUCKET           = module.s3.user_uploads_bucket_name
  SQS_BOOKING_QUEUE_URL       = module.sqs.booking_processing_queue_url
  SNS_NOTIFICATIONS_TOPIC_ARN = module.sns.user_notifications_topic_arn
}
```

## Security Best Practices

1. **Never commit secrets to git**
2. **Rotate secrets regularly** (every 90 days)
3. **Use different credentials for each environment**
4. **Enable MFA for AWS root account**
5. **Use IAM roles with least privilege**
6. **Enable AWS CloudTrail for audit logging**
7. **Store production secrets only in AWS Secrets Manager**
8. **Use GitHub environment protection rules**

## Setting Up GitHub Secrets

1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret from the list above

## Setting Up GitHub Environments

Create three environments with protection rules:

### Dev Environment
- No approvals required
- Auto-deploy on push to `develop` branch

### Stage Environment
- Require reviewers: 1 person
- Wait timer: 0 minutes
- Deploy from `main` branch

### Production Environment
- Require reviewers: 2 people
- Wait timer: 0 minutes
- Manual workflow dispatch only
- Restrict to specific branches: `main`

## Validation

After setting up secrets, validate with:

```bash
# Test AWS credentials
aws sts get-caller-identity

# Test Secrets Manager access
aws secretsmanager list-secrets

# Run local validation
npm run validate:secrets
```

