# Infrastructure Bootstrap Guide

This guide covers the one-time setup required before deploying any environment.

## Prerequisites

- AWS CLI configured with admin credentials
- Terraform >= 1.6.0 installed
- AWS Account ID

## Step 1: Create Terraform State Backend

The Terraform state backend (S3 + DynamoDB) must be created once per AWS account before deploying any environment.

### 1.1 Update Configuration

```bash
cd infra/bootstrap

# Replace YOUR_ACCOUNT_ID with your actual AWS account ID
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
sed -i "s/YOUR_ACCOUNT_ID/${AWS_ACCOUNT_ID}/g" backend.tf
```

### 1.2 Initialize and Apply

```bash
terraform init

terraform apply \
  -var="create_state_backend=true" \
  -var="aws_account_id=${AWS_ACCOUNT_ID}"
```

This creates:
- **S3 Bucket**: `warmpawz-terraform-state-${AWS_ACCOUNT_ID}`
  - Versioning enabled
  - Encryption enabled
  - Public access blocked
  
- **DynamoDB Table**: `warmpawz-terraform-locks`
  - Used for state locking
  - Prevents concurrent modifications

### 1.3 Verify Creation

```bash
# Check S3 bucket
aws s3 ls | grep warmpawz-terraform-state

# Check DynamoDB table
aws dynamodb describe-table \
  --table-name warmpawz-terraform-locks \
  --query 'Table.TableStatus'
```

## Step 2: Update Environment Backend Configs

Update all environment backend configurations with your account ID:

```bash
# Update dev
sed -i "s/YOUR_ACCOUNT_ID/${AWS_ACCOUNT_ID}/g" ../envs/dev/backend.hcl

# Update stage
sed -i "s/YOUR_ACCOUNT_ID/${AWS_ACCOUNT_ID}/g" ../envs/stage/backend.hcl

# Update prod
sed -i "s/YOUR_ACCOUNT_ID/${AWS_ACCOUNT_ID}/g" ../envs/prod/backend.hcl
```

## Step 3: Set Up AWS Secrets Manager

Create base secrets for each environment:

```bash
# Run the setup script
chmod +x ../../scripts/setup-secrets.sh

# For development
../../scripts/setup-secrets.sh dev

# For stage (repeat prompts)
../../scripts/setup-secrets.sh stage

# For production (repeat prompts)
../../scripts/setup-secrets.sh prod
```

Or create manually:

```bash
# Razorpay
aws secretsmanager create-secret \
  --name "warmpawz/dev/razorpay" \
  --secret-string '{
    "key_id": "YOUR_KEY",
    "key_secret": "YOUR_SECRET"
  }'

# Stripe
aws secretsmanager create-secret \
  --name "warmpawz/dev/stripe" \
  --secret-string '{
    "secret_key": "sk_test_...",
    "publishable_key": "pk_test_..."
  }'

# Shiprocket
aws secretsmanager create-secret \
  --name "warmpawz/dev/shiprocket" \
  --secret-string '{
    "email": "your@email.com",
    "password": "your_password"
  }'

# Google Maps
aws secretsmanager create-secret \
  --name "warmpawz/dev/google-maps" \
  --secret-string '{
    "api_key": "YOUR_API_KEY"
  }'
```

## Step 4: Verify AWS Permissions

Ensure your IAM user/role has the required permissions:

```bash
# Test permissions
aws iam get-user
aws ec2 describe-vpcs --max-results 1
aws rds describe-db-clusters --max-results 1
aws lambda list-functions --max-results 1
```

If any command fails, attach the required policies to your IAM user/role.

## Step 5: Create GitHub Environments

1. Go to your GitHub repository
2. Navigate to **Settings** → **Environments**
3. Create three environments:

### Dev Environment
- Name: `dev`
- Protection rules: None
- Deployment branches: `develop`

### Stage Environment
- Name: `stage`
- Protection rules:
  - Required reviewers: 1
  - Wait timer: 0 minutes
- Deployment branches: `main`

### Stage Approval Environment
- Name: `stage-approval`
- Protection rules:
  - Required reviewers: 1
- Deployment branches: `main`

### Production Environment
- Name: `production`
- Protection rules:
  - Required reviewers: 2
  - Wait timer: 0 minutes
- Deployment branches: `main`

### Production Approval Environment
- Name: `production-approval`
- Protection rules:
  - Required reviewers: 2
- Deployment branches: `main`

## Step 6: Add GitHub Secrets

Add the following secrets to your GitHub repository:

### Repository Secrets
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION (e.g., us-east-1)
AWS_ACCOUNT_ID
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
SHIPROCKET_EMAIL
SHIPROCKET_PASSWORD
GOOGLE_MAPS_API_KEY
SLACK_WEBHOOK_URL (optional)
CODECOV_TOKEN (optional)
```

### Environment-Specific Secrets

**Dev:**
```
DEV_OPENSEARCH_PASSWORD (optional)
```

**Stage:**
```
STAGE_OPENSEARCH_PASSWORD
```

**Production:**
```
PROD_OPENSEARCH_PASSWORD
```

## Step 7: Verify Bootstrap

Run the verification script:

```bash
cd ../../scripts

# Create verification script
cat > verify-bootstrap.sh << 'EOF'
#!/bin/bash
set -e

echo "🔍 Verifying bootstrap setup..."

# Check AWS CLI
echo "✓ Checking AWS CLI..."
aws --version

# Check Terraform
echo "✓ Checking Terraform..."
terraform version

# Check AWS credentials
echo "✓ Checking AWS credentials..."
aws sts get-caller-identity

# Check S3 bucket
echo "✓ Checking Terraform state bucket..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws s3 ls s3://warmpawz-terraform-state-${ACCOUNT_ID} || echo "❌ Bucket not found"

# Check DynamoDB table
echo "✓ Checking Terraform locks table..."
aws dynamodb describe-table --table-name warmpawz-terraform-locks > /dev/null || echo "❌ Table not found"

# Check secrets
echo "✓ Checking secrets..."
aws secretsmanager list-secrets --query 'SecretList[?contains(Name, `warmpawz`)].Name' --output table

echo ""
echo "✅ Bootstrap verification complete!"
EOF

chmod +x verify-bootstrap.sh
./verify-bootstrap.sh
```

## Step 8: First Deployment Test

Test the setup by deploying to dev:

```bash
cd ../infra/envs/dev

# Initialize
terraform init -backend-config=backend.hcl

# Plan
terraform plan

# If plan looks good, apply
terraform apply
```

## Troubleshooting

### Error: Bucket already exists
If you get a bucket already exists error:
```bash
# Import existing bucket
terraform import aws_s3_bucket.terraform_state warmpawz-terraform-state-${AWS_ACCOUNT_ID}
```

### Error: Table already exists
If you get a table already exists error:
```bash
# Import existing table
terraform import aws_dynamodb_table.terraform_locks warmpawz-terraform-locks
```

### Error: Access Denied
Check IAM permissions:
```bash
aws iam get-user-policy --user-name YOUR_USERNAME --policy-name YOUR_POLICY
```

### State Lock Issues
If state is locked:
```bash
terraform force-unlock <LOCK_ID>
```

## Next Steps

After bootstrap is complete:
1. Deploy to dev environment
2. Run tests
3. Deploy to stage (requires approval)
4. Run full test suite
5. Deploy to production (requires strict approval)

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

## Summary

✅ Terraform state backend created
✅ Environment backend configs updated
✅ AWS Secrets Manager configured
✅ GitHub environments created
✅ GitHub secrets added
✅ Bootstrap verified

You're now ready to deploy! 🚀

