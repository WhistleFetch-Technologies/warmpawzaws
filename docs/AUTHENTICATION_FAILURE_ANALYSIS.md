# Aurora PostgreSQL Authentication Failure Analysis

## Problem Summary

**Error:** `password authentication failed for user "warmpawz_admin"`

**Context:**
- Network connectivity: ✅ **RESOLVED** (TCP connection succeeds)
- DNS resolution: ✅ Working
- Security groups: ✅ Configured correctly
- Authentication: ❌ **FAILING**

## Root Cause Analysis

### 1. Most Likely Reasons for Authentication Failure

**A. Password Mismatch (Most Likely)**
- Secrets Manager password ≠ RDS cluster password
- Password was rotated in Secrets Manager but RDS cluster wasn't updated
- Terraform created RDS with one password, but Secrets Manager was updated separately

**B. Username Mismatch**
- RDS cluster master username ≠ `warmpawz_admin`
- User doesn't exist in PostgreSQL (though unlikely if it's the master user)

**C. Secret Structure Mismatch**
- Secret JSON structure doesn't match what the script expects
- Field names are different (`password` vs `Password`, `username` vs `Username`)

**D. Secret Version/Stage Mismatch**
- Using wrong secret version
- Secret was deleted/recreated but ARN reference is stale

### 2. Could This Be Caused By...

**✅ Wrong password in Secrets Manager?**
- **YES** - If Secrets Manager was updated manually but RDS wasn't

**✅ Password rotated but app/CI not updated?**
- **YES** - If password was rotated via AWS Console or CLI but Terraform state wasn't updated

**✅ User exists but password differs?**
- **YES** - RDS cluster password is managed separately from Secrets Manager

**✅ Connecting to wrong cluster/environment?**
- **UNLIKELY** - Endpoint is correct, DNS resolves correctly

**✅ pg_hba.conf / rds.force_ssl / auth settings?**
- **UNLIKELY** - These would cause different errors (SSL required, host not allowed)

### 3. How to Verify

**A. Check RDS Master Username:**
```bash
aws rds describe-db-clusters \
  --db-cluster-identifier warmpawz-prod-cluster \
  --region ap-south-1 \
  --query 'DBClusters[0].MasterUsername' \
  --output text
```

**B. Check Secrets Manager Secret:**
```bash
# Get secret ARN from Terraform
SECRET_ARN=$(terraform output -raw rds_secret_arn)

# Get secret value
aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --region ap-south-1 \
  --query SecretString \
  --output text | jq .

# Check username and password fields
aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --region ap-south-1 \
  --query SecretString \
  --output text | jq -r '.username, .password'
```

**C. Test Connection with Secret Password:**
```bash
# Get credentials
SECRET_ARN=$(terraform output -raw rds_secret_arn)
DB_SECRET=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --region ap-south-1 --query SecretString --output text)
DB_USERNAME=$(echo "$DB_SECRET" | jq -r '.username // .Username // "warmpawz_admin"')
DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password // .Password // ""')
RDS_ENDPOINT=$(terraform output -raw rds_endpoint)

# Test connection
PGPASSWORD="$DB_PASSWORD" psql -h "$RDS_ENDPOINT" -U "$DB_USERNAME" -d warmpawz -c "SELECT version();"
```

**D. Check if User Exists in Database:**
```bash
# Connect as master user (if you know the password)
# Then run:
SELECT usename FROM pg_user WHERE usename = 'warmpawz_admin';
```

### 4. AWS-Side Checks

**A. RDS Console:**
1. Go to RDS → Databases → `warmpawz-prod-cluster`
2. Check "Configuration" tab → "Master username"
3. Verify it's `warmpawz_admin`

**B. Secrets Manager:**
1. Go to Secrets Manager → Find secret matching `warmpawz-prod-rds-master-*`
2. Check secret value structure
3. Verify username and password fields exist
4. Check secret versions (if rotation is enabled)

**C. Terraform State:**
```bash
cd infra/envs/prod
terraform state show module.rds.random_password.master
terraform state show module.rds.aws_secretsmanager_secret_version.rds_master_password
```

**D. Check for Drift:**
```bash
# Compare Terraform state with actual RDS
terraform plan
# Look for changes to:
# - random_password.master
# - aws_secretsmanager_secret_version.rds_master_password
```

### 5. Step-by-Step Fix Checklist

#### Step 1: Verify Current State
- [ ] Check RDS master username: `aws rds describe-db-clusters ...`
- [ ] Get secret ARN from Terraform: `terraform output -raw rds_secret_arn`
- [ ] Retrieve secret value: `aws secretsmanager get-secret-value ...`
- [ ] Verify secret structure has `username` and `password` fields

#### Step 2: Identify the Mismatch
- [ ] Compare RDS master username with secret username
- [ ] Check if password in secret matches what RDS expects
- [ ] Verify secret ARN matches Terraform output

#### Step 3: Fix the Password Mismatch

**Option A: Update RDS Password to Match Secrets Manager**
```bash
# Get password from Secrets Manager
SECRET_ARN=$(terraform output -raw rds_secret_arn)
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --region ap-south-1 \
  --query SecretString \
  --output text | jq -r '.password // .Password')

# Update RDS cluster password
aws rds modify-db-cluster \
  --db-cluster-identifier warmpawz-prod-cluster \
  --master-user-password "$DB_PASSWORD" \
  --apply-immediately \
  --region ap-south-1
```

**Option B: Update Secrets Manager to Match RDS**
```bash
# Get current RDS password (if you have it)
# Or generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# Update Secrets Manager
SECRET_ARN=$(terraform output -raw rds_secret_arn)
aws secretsmanager put-secret-value \
  --secret-id "$SECRET_ARN" \
  --secret-string "{\"username\":\"warmpawz_admin\",\"password\":\"$NEW_PASSWORD\"}" \
  --region ap-south-1

# Update RDS cluster password
aws rds modify-db-cluster \
  --db-cluster-identifier warmpawz-prod-cluster \
  --master-user-password "$NEW_PASSWORD" \
  --apply-immediately \
  --region ap-south-1
```

**Option C: Use Terraform to Sync (Recommended)**
```bash
cd infra/envs/prod
# Force Terraform to update password
terraform taint module.rds.random_password.master
terraform apply
```

#### Step 4: Verify Fix
- [ ] Test connection with updated credentials
- [ ] Run migration script to confirm authentication works
- [ ] Remove temporary `0.0.0.0/0` security group rule (if added)

#### Step 5: Update Workflow (If Needed)
- [ ] Verify workflow correctly parses secret JSON
- [ ] Add error handling for missing password field
- [ ] Add logging to show which username is being used (mask password)

## Common Issues and Solutions

### Issue 1: Secret JSON Structure Mismatch

**Symptom:** Script can't find `password` field

**Fix:** Update workflow to handle multiple field name variations:
```bash
DB_USERNAME=$(echo "$DB_SECRET" | jq -r '.username // .Username // .user // "warmpawz_admin"')
DB_PASSWORD=$(echo "$DB_SECRET" | jq -r '.password // .Password // .pass // ""')
```

### Issue 2: Password Contains Special Characters

**Symptom:** URL encoding issues in DATABASE_URL

**Fix:** Ensure password is properly URL-encoded:
```bash
DB_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$DB_PASSWORD''', safe=''))")
```

### Issue 3: Terraform State Drift

**Symptom:** Terraform thinks password is X, but RDS has Y

**Fix:** Import current state or force update:
```bash
terraform taint module.rds.random_password.master
terraform apply
```

## Prevention

1. **Always use Terraform to manage passwords** - Don't update manually
2. **Use `terraform apply` to sync** - Ensures RDS and Secrets Manager match
3. **Add validation step** - Test connection before running migrations
4. **Monitor for drift** - Run `terraform plan` regularly to catch changes
