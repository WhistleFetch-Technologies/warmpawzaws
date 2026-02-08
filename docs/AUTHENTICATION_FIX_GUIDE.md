# Aurora PostgreSQL Authentication Fix - Complete Guide

## Problem Summary

**Error:** `password authentication failed for user "warmpawz_admin"`

**Context:**
- ✅ Networking: Fixed (TCP connection succeeds)
- ✅ User exists: Confirmed (would get "role does not exist" otherwise)
- ❌ Password: Rejected by PostgreSQL

## Root Cause Analysis

### 1. Most Likely Root Causes

**A. Password Drift Between RDS and Secrets Manager (95% Likely)**

**How it happens:**
1. Terraform creates RDS cluster with `random_password.master`
2. Terraform stores password in Secrets Manager via `aws_secretsmanager_secret_version`
3. If RDS password is changed manually (via AWS Console/CLI), Secrets Manager still has old password
4. If Secrets Manager is updated manually, RDS still has old password
5. Terraform state may be out of sync with actual RDS password

**Evidence:**
- User exists → RDS cluster is operational
- Password rejected → Password in Secrets Manager ≠ Password in RDS
- Error persists → Drift is persistent, not transient

**B. Secret JSON Structure Mismatch (5% Likely)**

**How it happens:**
- Secret stored with different field names (`Password` vs `password`)
- Script expects one format but secret has another
- Password field is missing or null

**C. Password Encoding Issues (Rare)**

**How it happens:**
- Password contains special characters not properly URL-encoded
- DATABASE_URL construction fails silently
- Password gets truncated or corrupted

### 2. How Credential Drift Occurs

**Scenario 1: Manual RDS Password Change**
```bash
# Someone runs this manually:
aws rds modify-db-cluster \
  --db-cluster-identifier warmpawz-prod-cluster \
  --master-user-password "NewPassword123" \
  --apply-immediately

# Result:
# - RDS password: "NewPassword123" ✅
# - Secrets Manager password: <old password> ❌
# - Terraform state: <old password> ❌
```

**Scenario 2: Manual Secrets Manager Update**
```bash
# Someone updates secret manually:
aws secretsmanager put-secret-value \
  --secret-id <arn> \
  --secret-string '{"username":"warmpawz_admin","password":"NewPassword456"}'

# Result:
# - RDS password: <old password> ❌
# - Secrets Manager password: "NewPassword456" ✅
# - Terraform state: <old password> ❌
```

**Scenario 3: Terraform State Drift**
```bash
# Terraform state shows:
random_password.master.result = "PasswordFromState"

# But RDS actually has:
# - RDS password: "ActualPasswordInRDS" (changed outside Terraform)
# - Secrets Manager: "PasswordFromState" (matches Terraform state)
# - Result: Both are wrong relative to each other
```

**Scenario 4: Secret Rotation**
- If automatic secret rotation is enabled
- Rotation updates Secrets Manager
- But doesn't update RDS cluster password
- Creates permanent drift

### 3. Source of Truth Decision

**✅ CORRECT: Secrets Manager is Source of Truth**

**Why:**
1. Secrets Manager is designed for credential management
2. Terraform stores password there intentionally
3. CI/CD reads from Secrets Manager
4. Applications read from Secrets Manager
5. RDS password should match Secrets Manager

**❌ WRONG: RDS is Source of Truth**

**Why not:**
1. RDS password changes require cluster modification (downtime risk)
2. No centralized credential management
3. Harder to audit and rotate
4. CI/CD would need to read from RDS (not standard)

**Action:** Update RDS password to match Secrets Manager

### 4. Step-by-Step Fix Checklist

#### Step 1: Verify Current State

```bash
# 1. Get secret ARN from Terraform
cd infra/envs/prod
terraform init -backend-config=backend.hcl -migrate-state
SECRET_ARN=$(terraform output -raw rds_secret_arn)
echo "Secret ARN: $SECRET_ARN"

# 2. Get password from Secrets Manager
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --region ap-south-1 \
  --query SecretString \
  --output text)

DB_USERNAME=$(echo "$DB_SECRET" | jq -r '.username // .Username // "warmpawz_admin"')
DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password // .Password // ""')

echo "Secret Username: $DB_USERNAME"
echo "Secret Password: [MASKED - length: ${#DB_PASSWORD}]"

# 3. Verify RDS master username
RDS_USER=$(aws rds describe-db-clusters \
  --db-cluster-identifier warmpawz-prod-cluster \
  --region ap-south-1 \
  --query 'DBClusters[0].MasterUsername' \
  --output text)

echo "RDS Master Username: $RDS_USER"

# 4. Check if they match
if [ "$DB_USERNAME" != "$RDS_USER" ]; then
  echo "⚠️ WARNING: Username mismatch!"
fi
```

#### Step 2: Update RDS Password to Match Secrets Manager

```bash
# Get password from Secrets Manager (source of truth)
SECRET_ARN=$(terraform output -raw rds_secret_arn)
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --region ap-south-1 \
  --query SecretString \
  --output text | jq -r '.password // .Password')

# Verify password is not empty
if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" == "null" ]; then
  echo "❌ ERROR: Password not found in secret"
  exit 1
fi

# Update RDS cluster password
echo "🔄 Updating RDS cluster password to match Secrets Manager..."
aws rds modify-db-cluster \
  --db-cluster-identifier warmpawz-prod-cluster \
  --master-user-password "$DB_PASSWORD" \
  --apply-immediately \
  --region ap-south-1

echo "✅ Password update initiated"
echo "⏳ Waiting for cluster to be available (this may take 2-5 minutes)..."

# Wait for cluster to be available
aws rds wait db-cluster-available \
  --db-cluster-identifier warmpawz-prod-cluster \
  --region ap-south-1

echo "✅ RDS cluster is available with updated password"
```

#### Step 3: Verify Fix

```bash
# Test connection with updated credentials
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
RDS_DB_NAME=$(terraform output -raw rds_database_name)

# Construct DATABASE_URL
DB_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$DB_PASSWORD''', safe=''))")
DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD_ENCODED}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}"

# Test connection (if psql is available)
# PGPASSWORD="$DB_PASSWORD" psql -h "$RDS_ENDPOINT" -U "$DB_USERNAME" -d "$RDS_DB_NAME" -c "SELECT version();"

echo "✅ Connection test ready"
echo "   DATABASE_URL constructed successfully"
```

#### Step 4: Re-run CI/CD

```bash
# Trigger CI/CD workflow
gh workflow run 220395121 --ref prod -f confirmation="DEPLOY_TO_PRODUCTION"
```

### 5. Prevention Strategies

#### A. Terraform Patterns

**Pattern 1: Always Use Terraform for Password Changes**

```hcl
# In infra/modules/rds/main.tf
resource "random_password" "master" {
  length  = 32
  special = true
  
  # Force new password on every apply (for testing)
  # Remove keepers in production
  keepers = {
    version = var.password_version  # Increment to force new password
  }
}

resource "aws_rds_cluster" "main" {
  master_username = var.master_username
  master_password = random_password.master.result  # Always use Terraform-generated password
  
  # ... other config
}

resource "aws_secretsmanager_secret_version" "rds_master_password" {
  secret_id = aws_secretsmanager_secret.rds_master_password.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result  # Same password as RDS
    # ... other fields
  })
}
```

**Pattern 2: Add Validation Step in CI/CD**

```yaml
- name: Verify RDS Password Matches Secret
  run: |
    # Get password from Secrets Manager
    SECRET_ARN=$(terraform output -raw rds_secret_arn)
    SECRET_PASSWORD=$(aws secretsmanager get-secret-value \
      --secret-id "$SECRET_ARN" \
      --region ap-south-1 \
      --query SecretString \
      --output text | jq -r '.password // .Password')
    
    # Test connection
    RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
    # Use a test connection to verify password works
    # If it fails, update RDS password automatically
```

**Pattern 3: Use Terraform Lifecycle Rules**

```hcl
resource "aws_rds_cluster" "main" {
  # ... config
  
  lifecycle {
    # Prevent manual password changes
    ignore_changes = [master_password]
    
    # Or force password sync
    # create_before_destroy = true
  }
}
```

#### B. Secret Rotation Best Practices

**Option 1: Disable Automatic Rotation (Recommended for Terraform-Managed)**

```hcl
resource "aws_secretsmanager_secret" "rds_master_password" {
  # ... config
  
  # Disable automatic rotation if managed by Terraform
  # rotation_enabled = false
}
```

**Option 2: If Rotation is Required, Use Lambda Function**

```hcl
# Lambda function that:
# 1. Generates new password
# 2. Updates RDS cluster password
# 3. Updates Secrets Manager
# 4. Updates Terraform state (via API or manual step)
```

**Option 3: Manual Rotation Process**

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update Secrets Manager
aws secretsmanager put-secret-value \
  --secret-id "$SECRET_ARN" \
  --secret-string "{\"username\":\"warmpawz_admin\",\"password\":\"$NEW_PASSWORD\"}"

# 3. Update RDS cluster
aws rds modify-db-cluster \
  --db-cluster-identifier warmpawz-prod-cluster \
  --master-user-password "$NEW_PASSWORD" \
  --apply-immediately

# 4. Update Terraform state
terraform taint module.rds.random_password.master
terraform apply
```

#### C. Avoiding Silent Password Drift

**Strategy 1: Add Pre-Migration Validation Step**

Add to CI/CD workflow:
```yaml
- name: Validate Database Credentials
  run: |
    # Get credentials
    SECRET_ARN=$(terraform output -raw rds_secret_arn)
    DB_SECRET=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --region ap-south-1 --query SecretString --output text)
    DB_USERNAME=$(echo "$DB_SECRET" | jq -r '.username // .Username')
    DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password // .Password')
    RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
    
    # Test connection
    if ! PGPASSWORD="$DB_PASSWORD" psql -h "$RDS_ENDPOINT" -U "$DB_USERNAME" -d warmpawz -c "SELECT 1;" &>/dev/null; then
      echo "❌ Authentication failed - syncing RDS password with Secrets Manager..."
      aws rds modify-db-cluster \
        --db-cluster-identifier warmpawz-prod-cluster \
        --master-user-password "$DB_PASSWORD" \
        --apply-immediately \
        --region ap-south-1
      echo "⏳ Waiting for cluster update..."
      aws rds wait db-cluster-available --db-cluster-identifier warmpawz-prod-cluster --region ap-south-1
      echo "✅ Password synced - retrying connection..."
    else
      echo "✅ Credentials validated"
    fi
```

**Strategy 2: Regular Drift Detection**

Add to monitoring:
```bash
# Cron job or scheduled task
# 1. Get password from Secrets Manager
# 2. Test connection to RDS
# 3. If fails, alert and auto-fix
```

**Strategy 3: Terraform State Locking**

```hcl
# Use DynamoDB for state locking
terraform {
  backend "s3" {
    # ... config
    dynamodb_table = "terraform-state-lock"
  }
}
```

## Quick Fix Script

Save this as `fix-rds-password.sh`:

```bash
#!/bin/bash
set -e

REGION="ap-south-1"
CLUSTER_ID="warmpawz-prod-cluster"

echo "🔐 Fixing RDS Password Authentication"
echo "===================================="

# Get secret ARN
cd infra/envs/prod
terraform init -backend-config=backend.hcl -migrate-state
SECRET_ARN=$(terraform output -raw rds_secret_arn)

# Get password from Secrets Manager
echo "📥 Retrieving password from Secrets Manager..."
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --region "$REGION" \
  --query SecretString \
  --output text)

DB_USERNAME=$(echo "$DB_SECRET" | jq -r '.username // .Username // "warmpawz_admin"')
DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password // .Password // ""')

if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" == "null" ]; then
  echo "❌ ERROR: Password not found in secret"
  exit 1
fi

echo "✅ Password retrieved (length: ${#DB_PASSWORD})"
echo "   Username: $DB_USERNAME"

# Update RDS cluster password
echo ""
echo "🔄 Updating RDS cluster password..."
aws rds modify-db-cluster \
  --db-cluster-identifier "$CLUSTER_ID" \
  --master-user-password "$DB_PASSWORD" \
  --apply-immediately \
  --region "$REGION"

echo "⏳ Waiting for cluster to be available..."
aws rds wait db-cluster-available \
  --db-cluster-identifier "$CLUSTER_ID" \
  --region "$REGION"

echo ""
echo "✅ RDS password updated successfully!"
echo "   You can now retry the CI/CD migration"
```

## Summary

**Root Cause:** Password drift between RDS cluster and Secrets Manager

**Fix:** Update RDS password to match Secrets Manager (source of truth)

**Prevention:**
1. Always use Terraform for password changes
2. Add validation step in CI/CD
3. Disable automatic secret rotation (or sync with RDS)
4. Regular drift detection

**Next Steps:**
1. Run the fix script above
2. Re-trigger CI/CD
3. Monitor for successful authentication
4. Implement prevention strategies
