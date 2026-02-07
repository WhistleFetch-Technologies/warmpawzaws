# 🚀 Production Deployment Plan
## Using Dev RDS and Dev VPC for Production

**Date Created:** 2026-01-28  
**Status:** 📋 Ready for Implementation  
**Objective:** Deploy production infrastructure using existing dev RDS database and dev VPC

---

## 📋 Table of Contents

1. [Current Issues Identified](#current-issues-identified)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Information Gathering](#phase-1-information-gathering)
4. [Phase 2: Terraform Configuration](#phase-2-terraform-configuration)
5. [Phase 3: CI/CD Workflow Updates](#phase-3-cicd-workflow-updates)
6. [Phase 4: GitHub Secrets Configuration](#phase-4-github-secrets-configuration)
7. [Phase 5: Security Group Configuration](#phase-5-security-group-configuration)
8. [Phase 6: Testing & Verification](#phase-6-testing--verification)
9. [Phase 7: Deployment Execution](#phase-7-deployment-execution)
10. [Rollback Plan](#rollback-plan)

---

## 🔍 Current Issues Identified

### Critical Issues ❌

1. **Terraform Configuration:**
   - ❌ Creating new RDS cluster (should use dev RDS)
   - ❌ Creating new VPC (should use dev VPC)
   - ❌ Lambda configured for prod VPC (needs dev VPC)
   - ❌ Missing data sources for dev resources
   - ❌ Lambda env vars reference `module.rds` (will fail)

2. **CI/CD Workflow (`prod.yml`):**
   - ❌ Frontend build missing `NEXT_PUBLIC_*` environment variables
   - ❌ No production Cognito configuration
   - ❌ Missing `NEXT_PUBLIC_UAT_MODE: 'false'` for production

3. **Lambda Environment Variables:**
   - ❌ Missing `UAT_MODE = "false"`
   - ❌ Missing `ENVIRONMENT = "prod"`
   - ❌ Missing `API_BASE_URL`
   - ❌ Missing `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID`
   - ❌ Missing `RAZORPAY_SECRET_ARN`, `GOOGLE_MAPS_SECRET_ARN`, `SHIPROCKET_SECRET_ARN`

4. **Secrets Module (External Integrations):**
   - ❌ **MISSING ENTIRELY** - No secrets module in prod Terraform
   - ❌ Missing Razorpay variables (`razorpay_key_id`, `razorpay_key_secret`)
   - ❌ Missing Google Maps API key variable
   - ❌ Missing Shiprocket variables (optional)
   - ❌ No Razorpay values in `terraform.tfvars` (need live keys: `rzp_live_...`)
   - ❌ Lambda cannot access Razorpay secrets (will fail payment processing)

5. **Security Groups:**
   - ❌ Prod Lambda security group not allowed in dev RDS security group

6. **Outputs:**
   - ❌ Still referencing `module.rds` which will be removed

---

## ✅ Prerequisites

Before starting, ensure you have:

- [ ] AWS CLI configured with appropriate credentials
- [ ] Terraform >= 1.0 installed
- [ ] Access to GitHub repository secrets
- [ ] Access to AWS Console (for verification)
- [ ] Dev environment already deployed and working
- [ ] Dev RDS cluster identifier: `warmpawz-dev-cluster`
- [ ] Dev VPC ID (to be gathered in Phase 1)

---

## 📊 Phase 1: Information Gathering

### Step 1.1: Get Dev VPC Information

```bash
# Navigate to dev environment
cd infra/envs/dev

# Initialize Terraform (if not already done)
terraform init

# Get dev VPC ID
terraform output vpc_id

# Get dev private subnet IDs
terraform output -json | jq -r '.private_subnet_ids.value[]'  # If output exists
# OR use AWS CLI:
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=<DEV_VPC_ID>" \
  --query 'Subnets[?MapPublicIpOnLaunch==`false`].{ID:SubnetId,Name:Tags[?Key==`Name`].Value|[0],CIDR:CidrBlock}' \
  --output table
```

**Document the following:**
- Dev VPC ID: `_________________`
- Dev Private Subnet IDs: `_________________`, `_________________`
- Dev VPC CIDR: `_________________`

### Step 1.2: Get Dev RDS Information

```bash
# Get dev RDS cluster details
aws rds describe-db-clusters \
  --db-cluster-identifier warmpawz-dev-cluster \
  --query 'DBClusters[0].{ID:DBClusterIdentifier,Endpoint:Endpoint,ReaderEndpoint:ReaderEndpoint,Port:Port,VpcId:VpcId,SecurityGroups:VpcSecurityGroups[*].VpcSecurityGroupId}' \
  --output table

# Get dev RDS secret ARN
cd infra/envs/dev
terraform output rds_secret_arn

# Get dev RDS security group ID
aws rds describe-db-clusters \
  --db-cluster-identifier warmpawz-dev-cluster \
  --query 'DBClusters[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text
```

**Document the following:**
- Dev RDS Cluster ID: `warmpawz-dev-cluster`
- Dev RDS Endpoint: `_________________`
- Dev RDS Reader Endpoint: `_________________`
- Dev RDS Port: `5432`
- Dev RDS Secret ARN: `_________________`
- Dev RDS Security Group ID: `_________________`

### Step 1.3: Gather Production Integration Keys

**⚠️ CRITICAL:** Before deploying to production, ensure you have:

1. **Razorpay Live Keys:**
   - Go to Razorpay Dashboard → Settings → API Keys
   - Generate/retrieve **LIVE** keys (NOT test keys)
   - Key ID format: `rzp_live_XXXXX`
   - Key Secret: `...`
   - Webhook Secret (if using webhooks): `...`

2. **Google Maps API Key:**
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Get your API key (or create new one)
   - Ensure it has Maps JavaScript API, Geocoding API enabled

3. **Shiprocket Credentials (if using):**
   - Email: `...`
   - Password: `...`

**Document the following:**
- Razorpay Live Key ID: `rzp_live__________________` (OR use dev test keys if sharing)
- Razorpay Live Secret: `_________________` (keep secure!)
- Razorpay Webhook Secret: `_________________` (if using)
- Google Maps API Key: `_________________`
- Shiprocket Email: `_________________` (if using)
- Shiprocket Password: `_________________` (if using)

**⚠️ IMPORTANT DECISION: Using Same Dev Razorpay Keys for Production**

**Option A: Use Separate Production Keys (Recommended for Real Payments)**
- Use LIVE keys (`rzp_live_...`) for production
- Separate from dev environment
- Real money transactions
- **Recommended if:** Processing real customer payments

**Option B: Use Same Dev Keys (Test/Sandbox Mode)**
- Use TEST keys (`rzp_test_...`) for production
- Same keys as dev environment
- Test/sandbox transactions only
- **Use if:** Still in testing phase, not processing real payments yet

**If Using Same Dev Keys:**
1. You can reference the existing dev secret: `warmpawz/dev/razorpay`
2. OR create prod secret with same test keys
3. **WARNING:** Real payments will NOT work with test keys
4. **WARNING:** Test keys are for development/testing only

**✅ Checklist:**
- [ ] Decision made: Separate prod keys OR same dev keys?
- [ ] If separate: Razorpay live keys obtained (NOT test keys)
- [ ] If same dev: Dev Razorpay keys documented
- [ ] Google Maps API key obtained
- [ ] Shiprocket credentials obtained (if needed)
- [ ] All credentials documented securely

### Step 1.4: Get Dev Cognito Information (if needed)

```bash
cd infra/envs/dev
terraform output cognito_user_pool_id
terraform output cognito_customer_client_id
```

**Document the following:**
- Dev Cognito User Pool ID: `_________________` (for reference, prod will create new)
- Dev Cognito Client ID: `_________________` (for reference, prod will create new)

### Step 1.4: Verify Dev Resources Exist

```bash
# Verify RDS cluster exists and is accessible
aws rds describe-db-clusters --db-cluster-identifier warmpawz-dev-cluster

# Verify VPC exists
aws ec2 describe-vpcs --vpc-ids <DEV_VPC_ID>

# Verify subnets exist
aws ec2 describe-subnets --subnet-ids <SUBNET_ID_1> <SUBNET_ID_2>
```

**✅ Checklist:**
- [ ] Dev VPC ID documented
- [ ] Dev private subnet IDs documented (at least 2)
- [ ] Dev RDS cluster exists and is accessible
- [ ] Dev RDS secret ARN documented
- [ ] Dev RDS security group ID documented

### Step 1.5: Verify Current Razorpay Secrets in AWS

**⚠️ IMPORTANT:** Check if production Razorpay secret already exists in AWS Secrets Manager.

```bash
# Check if prod Razorpay secret exists
aws secretsmanager list-secrets \
  --region ap-south-1 \
  --query "SecretList[?contains(Name, 'warmpawz/prod/razorpay')].{Name:Name,ARN:ARN,LastChangedDate:LastChangedDate}" \
  --output table

# Check if dev Razorpay secret exists (for reference)
aws secretsmanager list-secrets \
  --region ap-south-1 \
  --query "SecretList[?contains(Name, 'warmpawz/dev/razorpay')].{Name:Name,ARN:ARN,LastChangedDate:LastChangedDate}" \
  --output table

# If dev secret exists, view its structure (for reference only)
aws secretsmanager get-secret-value \
  --secret-id warmpawz/dev/razorpay \
  --region ap-south-1 \
  --query SecretString \
  --output text | jq
```

**Expected Results:**
- **Dev secret:** Should exist at `warmpawz/dev/razorpay` (with test keys: `rzp_test_...`)
- **Prod secret:** Should NOT exist yet (will be created by Terraform)

**What Happens If Prod Secret Doesn't Exist:**

If the production Razorpay secret is NOT created, Lambda will use fallback mechanisms:

1. **Primary:** Tries AWS Secrets Manager → `warmpawz/prod/razorpay` → **FAILS (secret doesn't exist)**
2. **Fallback 1:** Tries database (`platform_integrations` table) → May or may not have prod config
3. **Fallback 2:** Tries environment variables (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) → **FAILS (not set in Lambda env vars)**
4. **Final Result:** 
   ```
   Error: Razorpay not configured. Please configure in AWS Secrets Manager, 
   Platform Settings, or environment variables.
   ```
   - Payment endpoints return: `503 Service Unavailable`
   - Error code: `PAYMENT_GATEWAY_NOT_CONFIGURED`
   - **Payment features will NOT work in production**

**✅ Checklist:**
- [ ] Checked if prod Razorpay secret exists (should NOT exist yet)
- [ ] Verified dev Razorpay secret exists (for reference)
- [ ] Understood what happens if secret is missing (payment failures)

---

## 🏗️ Phase 2: Terraform Configuration

### Step 2.1: Add Data Sources for Dev Resources

**File:** `infra/envs/prod/main.tf`

**Location:** Add after line 38 (after `locals` block), before VPC module

```hcl
# ============================================
# DATA SOURCES - Reference Dev VPC and RDS
# ============================================

# Get dev VPC by ID (replace with actual dev VPC ID from Phase 1.1)
data "aws_vpc" "dev_vpc" {
  id = "vpc-XXXXX"  # ← REPLACE with actual dev VPC ID
}

# Get dev private subnets (for Lambda placement)
data "aws_subnets" "dev_private_subnets" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.dev_vpc.id]
  }
  
  # Filter by tag if your subnets have Type=private tag
  filter {
    name   = "tag:Type"
    values = ["private"]
  }
  
  # Alternative: Filter by CIDR block if subnets use 10.0.11.x or 10.0.12.x
  # filter {
  #   name   = "cidr-block"
  #   values = ["10.0.11.0/24", "10.0.12.0/24"]
  # }
}

# Get dev RDS cluster
data "aws_rds_cluster" "dev_cluster" {
  cluster_identifier = "warmpawz-dev-cluster"
}

# Get dev RDS secret (by name prefix)
data "aws_secretsmanager_secret" "dev_rds_secret" {
  name_prefix = "warmpawz-dev-rds-master"
}

# Alternative: If you know exact secret name, use:
# data "aws_secretsmanager_secret" "dev_rds_secret" {
#   name = "warmpawz-dev-rds-master-XXXXX"
# }

# Get dev RDS security group
data "aws_security_groups" "dev_rds_sg" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.dev_vpc.id]
  }
  
  filter {
    name   = "tag:Name"
    values = ["*rds*", "*dev-rds*"]
  }
}

# Local values for dev resources (matching module outputs)
locals {
  # VPC and networking
  dev_vpc_id            = data.aws_vpc.dev_vpc.id
  dev_vpc_cidr          = data.aws_vpc.dev_vpc.cidr_block
  dev_private_subnet_ids = data.aws_subnets.dev_private_subnets.ids
  
  # RDS information
  rds_cluster_endpoint       = data.aws_rds_cluster.dev_cluster.endpoint
  rds_cluster_reader_endpoint = data.aws_rds_cluster.dev_cluster.reader_endpoint
  rds_cluster_port            = data.aws_rds_cluster.dev_cluster.port
  rds_database_name           = data.aws_rds_cluster.dev_cluster.database_name
  rds_secret_arn              = data.aws_secretsmanager_secret.dev_rds_secret.arn
  rds_cluster_id              = data.aws_rds_cluster.dev_cluster.id
  
  # Security groups
  dev_rds_security_group_ids = data.aws_security_groups.dev_rds_sg.ids
}
```

### Step 2.2: Comment Out VPC Module

**File:** `infra/envs/prod/main.tf`

**Location:** Lines 40-54

**Action:** Comment out the entire VPC module block (we're using dev VPC)

```hcl
# ============================================
# VPC MODULE - NOT NEEDED (using dev VPC)
# ============================================
# module "vpc" {
#   source = "../../modules/vpc"
#   ...
# }
```

**Note:** If OpenSearch or other resources need VPC, we'll use dev VPC for them too.

### Step 2.3: Comment Out RDS Module

**File:** `infra/envs/prod/main.tf`

**Location:** Lines 66-85

**Action:** Comment out the entire RDS module block

```hcl
# ============================================
# RDS MODULE - NOT NEEDED (using dev RDS cluster)
# ============================================
# module "rds" {
#   source = "../../modules/rds"
#   ...
# }
```

### Step 2.4: Add Secrets Module (External Integrations)

**File:** `infra/envs/prod/main.tf`

**Location:** Add after SNS module (around line 61), before RDS module

**Action:** Add the secrets module to configure Razorpay, Google Maps, and Shiprocket

**⚠️ IMPORTANT:** Choose one of the following options based on whether you're using separate prod keys or same dev keys.

#### Option A: Create Separate Production Secret (Recommended for Real Payments)

```hcl
# ============================================
# SECRETS MODULE - External Integrations
# ============================================
module "secrets" {
  source = "../../modules/secrets"

  environment                = local.environment
  razorpay_key_id            = var.razorpay_key_id
  razorpay_key_secret        = var.razorpay_key_secret
  razorpay_x_account_number  = var.razorpay_x_account_number
  google_maps_api_key        = var.google_maps_api_key
  shiprocket_email           = var.shiprocket_email
  shiprocket_password        = var.shiprocket_password
}
```

**This creates:** `warmpawz/prod/razorpay` secret in AWS Secrets Manager

#### Option B: Use Same Dev Razorpay Secret (Test/Sandbox Mode)

If you want to use the same dev Razorpay keys for production (test/sandbox mode):

```hcl
# ============================================
# SECRETS MODULE - External Integrations (Google Maps, Shiprocket only)
# ============================================
module "secrets" {
  source = "../../modules/secrets"

  environment                = local.environment
  # Razorpay - NOT creating new secret, will reference dev secret
  razorpay_key_id            = ""  # Not used if referencing dev secret
  razorpay_key_secret        = ""  # Not used if referencing dev secret
  razorpay_x_account_number  = ""
  google_maps_api_key        = var.google_maps_api_key
  shiprocket_email           = var.shiprocket_email
  shiprocket_password        = var.shiprocket_password
}

# Data source to reference dev Razorpay secret
data "aws_secretsmanager_secret" "dev_razorpay_secret" {
  name = "warmpawz/dev/razorpay"
}

# Local value for Razorpay secret ARN (use dev secret)
locals {
  # ... existing locals ...
  razorpay_secret_arn = data.aws_secretsmanager_secret.dev_razorpay_secret.arn
}
```

**Then update Lambda env vars to use dev secret:**
```hcl
common_env_vars = {
  # ... other vars ...
  RAZORPAY_SECRET_ARN = local.razorpay_secret_arn  # Use dev secret instead of module.secrets.razorpay_secret_arn
}
```

**⚠️ WARNINGS for Option B:**
- ❌ Test keys (`rzp_test_...`) will NOT process real payments
- ❌ All transactions will be in sandbox/test mode
- ❌ Real money will NOT be charged
- ✅ Use only if still in testing/development phase
- ✅ Good for UAT/staging environments
- ⚠️ **Switch to LIVE keys before processing real customer payments**

**Recommendation:**
- **For Production with Real Payments:** Use Option A with LIVE keys
- **For Testing/Staging:** Use Option B with dev test keys

**File:** `infra/envs/prod/variables.tf`

**Location:** Add at the end of the file

**Action:** Add variables for external integrations

```hcl
# ============================================
# External Integration Variables
# ============================================

variable "razorpay_key_id" {
  description = "Razorpay API Key ID (use rzp_live_... for production)"
  type        = string
  sensitive   = true
}

variable "razorpay_key_secret" {
  description = "Razorpay API Key Secret"
  type        = string
  sensitive   = true
}

variable "razorpay_x_account_number" {
  description = "RazorpayX Current Account number (payout source) for vendor payouts"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_maps_api_key" {
  description = "Google Maps API key"
  type        = string
  sensitive   = true
}

variable "shiprocket_email" {
  description = "Shiprocket account email"
  type        = string
  default     = ""
  sensitive   = true
}

variable "shiprocket_password" {
  description = "Shiprocket account password"
  type        = string
  default     = ""
  sensitive   = true
}
```

**File:** `infra/envs/prod/terraform.tfvars`

**Location:** Add at the end of the file

**Action:** Add Razorpay and other integration values

```hcl
# ============================================
# External Integrations
# ============================================

# Razorpay Configuration
# ============================================
# OPTION 1: Use Separate Production LIVE Keys (Recommended for Real Payments)
# ============================================
razorpay_key_id     = "rzp_live_XXXXX"  # ← Replace with your production LIVE key
razorpay_key_secret = "your_live_secret"  # ← Replace with your production LIVE secret
razorpay_x_account_number = ""  # Optional: RazorpayX account number for payouts

# ============================================
# OPTION 2: Use Same Dev TEST Keys (For Testing/Staging Only)
# ============================================
# If using same dev keys, use the test keys from dev environment:
# razorpay_key_id     = "rzp_test_Rnp57suJH3wzUl"  # ← Same as dev (TEST key)
# razorpay_key_secret = "rplcWAxtmVfvXI9uydFt7YkH"  # ← Same as dev (TEST key)
# razorpay_x_account_number = "925020033295934"  # ← Same as dev (if applicable)

# ⚠️ CRITICAL DECISION:
# - Option 1 (LIVE keys): Real payments will work, real money transactions
# - Option 2 (TEST keys): Only test/sandbox payments, NO real money transactions
# - Choose based on whether you're processing real customer payments or still testing

# Google Maps
google_maps_api_key = "AIza..."  # ← Replace with your Google Maps API key

# Shiprocket (optional - only if using)
shiprocket_email    = ""  # Optional
shiprocket_password = ""  # Optional
```

**⚠️ CRITICAL DECISION:** Choose Your Razorpay Key Strategy

**Option 1: Separate Production Keys (Recommended for Real Payments)**
- ✅ Use LIVE keys (`rzp_live_...`) for production
- ✅ Separate from dev environment
- ✅ Real money transactions will work
- ✅ Recommended if processing real customer payments
- ⚠️ **DO NOT use test keys if processing real payments**

**Option 2: Same Dev Keys (Test/Sandbox Mode)**
- ⚠️ Use TEST keys (`rzp_test_...`) - same as dev
- ⚠️ Same keys as dev environment
- ❌ **Real payments will NOT work** - only test/sandbox transactions
- ❌ **NO real money will be charged**
- ✅ Use only if still in testing/development phase
- ✅ Good for UAT/staging before going live

**What Happens When You Run `terraform apply`:**

1. **Terraform creates the secret** in AWS Secrets Manager at: `warmpawz/prod/razorpay`
2. **Secret structure** (automatically created by Terraform):
   ```json
   {
     "keyId": "rzp_live_XXXXX",
     "keySecret": "your_live_secret",
     "key_id": "rzp_live_XXXXX",        // snake_case for compatibility
     "key_secret": "your_live_secret",   // snake_case for compatibility
     "razorpayXAccountNumber": "...",    // Optional
     "webhookSecret": "..."              // Optional, add manually if needed
   }
   ```
3. **Lambda automatically gets access** via IAM permissions (from `secrets_arns` in Lambda module)
4. **No manual AWS Console steps needed** - Terraform handles everything

**If You DON'T Create This Secret:**

- ❌ Lambda will try to load from Secrets Manager → **FAILS (secret doesn't exist)**
- ❌ Lambda will try database fallback → **MAY FAIL (if no prod config in DB)**
- ❌ Lambda will try environment variables → **FAILS (not set)**
- ❌ **Final result:** `503 Service Unavailable` with error `PAYMENT_GATEWAY_NOT_CONFIGURED`
- ❌ **Payment features will NOT work in production**

**You MUST create this secret for production payments to work.**

### Step 2.5: Update Lambda Module

**File:** `infra/envs/prod/main.tf`

**Location:** Lines 116-163

**Changes:**

1. **Update VPC and subnet references:**
```hcl
module "lambda" {
  source = "../../modules/lambda"

  environment        = local.environment
  aws_region         = var.aws_region
  vpc_id             = local.dev_vpc_id  # ← Changed from module.vpc.vpc_id
  private_subnet_ids = local.dev_private_subnet_ids  # ← Changed from module.vpc.private_subnet_ids
```

2. **Update common_env_vars:**
```hcl
  common_env_vars = {
    # Database - using dev RDS
    DB_HOST                     = local.rds_cluster_endpoint
    DB_READER_HOST              = local.rds_cluster_reader_endpoint
    DB_NAME                     = local.rds_database_name
    DB_SECRET_ARN               = local.rds_secret_arn
    
    # Environment configuration
    UAT_MODE                    = "false"  # ← ADD THIS
    ENVIRONMENT                 = "prod"   # ← ADD THIS
    NODE_ENV                    = "production"  # ← ADD THIS
    
    # API configuration
    API_BASE_URL                = "https://api.warmpawz.com"  # ← ADD THIS (or use var)
    
    # Cognito - will be set after Cognito module is created
    COGNITO_USER_POOL_ID        = module.cognito.user_pool_id  # ← ADD THIS
    COGNITO_CLIENT_ID           = module.cognito.customer_web_client_id  # ← ADD THIS
    
    # Other services (prod-specific)
    DYNAMODB_SESSIONS_TABLE     = module.dynamodb.sessions_table_name
    DYNAMODB_CACHE_TABLE        = module.dynamodb.cache_table_name
    DYNAMODB_ANALYTICS_TABLE    = module.dynamodb.analytics_events_table_name
    S3_UPLOADS_BUCKET           = module.s3.user_uploads_bucket_name
    SQS_BOOKING_QUEUE_URL       = module.sqs.booking_processing_queue_url
    SQS_PAYMENT_QUEUE_URL       = module.sqs.payment_processing_queue_url
    SQS_NOTIFICATION_QUEUE_URL  = module.sqs.notification_delivery_queue_url
    SNS_NOTIFICATIONS_TOPIC_ARN = module.sns.user_notifications_topic_arn
    SNS_BOOKING_TOPIC_ARN       = module.sns.booking_updates_topic_arn
    SNS_PAYMENT_TOPIC_ARN       = module.sns.payment_events_topic_arn
    SNS_VENDOR_TOPIC_ARN        = module.sns.vendor_notifications_topic_arn  # ← ADD THIS
    OPENSEARCH_ENDPOINT         = module.opensearch.domain_endpoint
    
    # External Integration Secrets
    RAZORPAY_SECRET_ARN         = module.secrets.razorpay_secret_arn  # ← ADD THIS
    GOOGLE_MAPS_SECRET_ARN      = module.secrets.google_maps_secret_arn  # ← ADD THIS
    SHIPROCKET_SECRET_ARN       = module.secrets.shiprocket_secret_arn  # ← ADD THIS (if using)
  }
```

3. **Update secrets_arns:**
```hcl
  secrets_arns    = [
    "${local.rds_secret_arn}",
    "${module.secrets.razorpay_secret_arn}",  # ← ADD THIS
    "${module.secrets.google_maps_secret_arn}",  # ← ADD THIS
    "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:*"
  ]
```

### Step 2.6: Update OpenSearch Module (if using dev VPC)

**File:** `infra/envs/prod/main.tf`

**Location:** Lines 231-250

**Changes:**
```hcl
module "opensearch" {
  source = "../../modules/opensearch"

  environment                = local.environment
  vpc_id                     = local.dev_vpc_id  # ← Changed from module.vpc.vpc_id
  vpc_cidr                   = local.dev_vpc_cidr  # ← Changed from "10.2.0.0/16"
  private_subnet_ids         = local.dev_private_subnet_ids  # ← Changed from module.vpc.private_subnet_ids
  allowed_security_groups    = [module.lambda.lambda_security_group_id]
  # ... rest of config remains same
}
```

### Step 2.7: Update Outputs

**File:** `infra/envs/prod/outputs.tf`

**Replace all RDS outputs with:**

```hcl
output "vpc_id" {
  description = "VPC ID (using dev VPC)"
  value       = local.dev_vpc_id
}

output "rds_endpoint" {
  description = "RDS cluster endpoint (using dev cluster)"
  value       = local.rds_cluster_endpoint
  sensitive   = true
}

output "rds_reader_endpoint" {
  description = "RDS cluster reader endpoint (using dev cluster)"
  value       = local.rds_cluster_reader_endpoint
  sensitive   = true
}

output "rds_database_name" {
  description = "RDS database name (using dev cluster)"
  value       = local.rds_database_name
}

output "rds_port" {
  description = "RDS cluster port (using dev cluster)"
  value       = local.rds_cluster_port
}

output "rds_secret_arn" {
  description = "RDS credentials secret ARN (using dev secret)"
  value       = local.rds_secret_arn
}
```

**✅ Checklist:**
- [ ] Data sources added for dev VPC, subnets, RDS, secret
- [ ] VPC module commented out
- [ ] RDS module commented out
- [ ] **Secrets module added with Razorpay, Google Maps, Shiprocket**
- [ ] **Razorpay variables added to `variables.tf`**
- [ ] **Razorpay values added to `terraform.tfvars` (with LIVE keys)**
- [ ] Lambda module updated to use dev VPC and RDS
- [ ] Lambda env vars updated (UAT_MODE, ENVIRONMENT, API_BASE_URL, COGNITO_*, RAZORPAY_SECRET_ARN)
- [ ] Lambda `secrets_arns` updated to include Razorpay and Google Maps secrets
- [ ] OpenSearch updated to use dev VPC (if applicable)
- [ ] Outputs updated to use local values

---

## 🔄 Phase 3: CI/CD Workflow Updates

### Step 3.1: Update Frontend Build Step

**File:** `.github/workflows/prod.yml`

**Location:** Lines 119-122

**Current:**
```yaml
- name: Build with production optimizations
  run: |
    npm run build:backend -- --production
    npm run build:frontend -- --production
```

**Change to:**
```yaml
- name: Build with production optimizations
  env:
    NEXT_PUBLIC_API_BASE_URL: ${{ secrets.PROD_API_URL || 'https://api.warmpawz.com' }}
    NEXT_PUBLIC_COGNITO_USER_POOL_ID: ${{ secrets.PROD_COGNITO_USER_POOL_ID }}
    NEXT_PUBLIC_COGNITO_CLIENT_ID: ${{ secrets.PROD_COGNITO_CLIENT_ID }}
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: ${{ secrets.GOOGLE_MAPS_API_KEY }}
    NEXT_PUBLIC_UAT_MODE: 'false'
    NODE_ENV: production
  run: |
    npm run build:backend -- --production
    npm run build:frontend -- --production
```

**Note:** The Cognito secrets will be added after first Terraform deployment (see Phase 4).

### Step 3.2: Verify Database Migration Step

**File:** `.github/workflows/prod.yml`

**Location:** Lines 283-306

**Verify:** This step should work correctly as it reads from Terraform outputs, which we've updated.

**No changes needed** - it will automatically use dev RDS.

**✅ Checklist:**
- [ ] Frontend build step updated with environment variables
- [ ] Database migration step verified (uses Terraform outputs)

---

## 🔐 Phase 4: GitHub Secrets Configuration

### Step 4.1: Deploy Infrastructure First (to get Cognito IDs)

**Action:** Run Terraform apply to create Cognito, then get the IDs

```bash
cd infra/envs/prod
terraform init
terraform plan  # Review changes
terraform apply  # Apply infrastructure (without RDS/VPC)
```

### Step 4.2: Get Production Cognito IDs

```bash
# After Terraform apply, get Cognito outputs
terraform output cognito_user_pool_id
terraform output cognito_customer_client_id  # If this output exists
# OR check Cognito module outputs
```

### Step 4.3: Add GitHub Secrets

Go to GitHub Repository → Settings → Secrets and variables → Actions

**Add the following secrets:**

1. **PROD_API_URL**
   - Value: `https://api.warmpawz.com` (or get from Terraform output after deployment)
   - Get from: `terraform output api_endpoint` or `terraform output custom_domain_url`

2. **PROD_COGNITO_USER_POOL_ID**
   - Value: Get from `terraform output cognito_user_pool_id` (after first deployment)
   - Source: Terraform output after Cognito module is created

3. **PROD_COGNITO_CLIENT_ID**
   - Value: Get from Cognito module (may need to check module outputs or AWS Console)
   - Source: After Cognito module creates client apps

4. **PROD_OPENSEARCH_PASSWORD** (if not already exists)
   - Value: Strong password for OpenSearch
   - Generate: Use a password manager or `openssl rand -base64 32`

5. **GOOGLE_MAPS_API_KEY** (if not already exists)
   - Value: Your Google Maps API key
   - Source: Google Cloud Console

**✅ Checklist:**
- [ ] PROD_API_URL added
- [ ] PROD_COGNITO_USER_POOL_ID added (after first deployment)
- [ ] PROD_COGNITO_CLIENT_ID added (after first deployment)
- [ ] PROD_OPENSEARCH_PASSWORD added
- [ ] GOOGLE_MAPS_API_KEY added (if needed)

---

## 🔒 Phase 5: Security Group Configuration

### Step 5.1: Get Prod Lambda Security Group ID

**After Terraform apply (first deployment):**

```bash
cd infra/envs/prod
terraform output -json | jq -r '.lambda_security_group_id.value'  # If output exists
# OR
aws lambda get-function-configuration \
  --function-name warmpawz-prod-api-handler \
  --query 'VpcConfig.SecurityGroupIds[0]' \
  --output text
```

**Document:** Prod Lambda Security Group ID: `_________________`

### Step 5.2: Update Dev RDS Security Group

**Option A: Manual Update (AWS Console)**

1. Go to EC2 → Security Groups
2. Find dev RDS security group (from Phase 1.2)
3. Edit inbound rules
4. Add rule:
   - Type: PostgreSQL
   - Port: 5432
   - Source: Prod Lambda Security Group ID (from Step 5.1)
   - Description: "Allow prod Lambda to access dev RDS"

**Option B: Update Dev Terraform (if managing RDS SG there)**

**File:** `infra/envs/dev/main.tf`

**Location:** RDS module (around line 130)

```hcl
module "rds" {
  # ... existing config
  
  allowed_security_groups = [
    module.lambda.lambda_security_group_id,
    "sg-PROD_LAMBDA_SG_ID"  # ← Add prod Lambda SG ID here
  ]
}
```

Then run `terraform apply` in dev environment.

**✅ Checklist:**
- [ ] Prod Lambda security group ID documented
- [ ] Dev RDS security group updated to allow prod Lambda
- [ ] Connectivity tested (see Phase 6)

---

## 🧪 Phase 6: Testing & Verification

### Step 6.1: Terraform Plan Verification

```bash
cd infra/envs/prod
terraform init
terraform plan
```

**Expected Results:**
- ✅ No RDS cluster creation
- ✅ No VPC creation (if VPC module commented out)
- ✅ Data sources reading dev resources
- ✅ Lambda will be created in dev VPC
- ✅ Lambda env vars pointing to dev RDS

**Review the plan carefully:**
- Check that no destructive changes are planned
- Verify data sources are correct
- Confirm Lambda configuration

### Step 6.2: Terraform Apply (Dry Run)

```bash
terraform plan -out=tfplan
terraform show tfplan | grep -E "(rds|vpc|lambda|will be created|will be destroyed)"
```

**Verify:**
- No RDS resources will be created
- No VPC resources will be created
- Lambda will be created with correct VPC/subnet references

### Step 6.3: Apply Infrastructure

```bash
terraform apply
```

**Monitor for:**
- Any errors during data source reads
- Lambda creation in dev VPC
- Security group creation
- Cognito creation

### Step 6.4: Verify Lambda Configuration

```bash
# Get Lambda function details
aws lambda get-function-configuration \
  --function-name warmpawz-prod-api-handler \
  --query '{VPC:VpcConfig.VpcId,Subnets:VpcConfig.SubnetIds,SecurityGroups:VpcConfig.SecurityGroupIds,EnvVars:Environment.Variables}' \
  --output json

# Verify environment variables
aws lambda get-function-configuration \
  --function-name warmpawz-prod-api-handler \
  --query 'Environment.Variables' \
  --output json | jq
```

**Verify:**
- ✅ VPC ID matches dev VPC
- ✅ Subnet IDs match dev private subnets
- ✅ DB_HOST points to dev RDS endpoint
- ✅ UAT_MODE = "false"
- ✅ ENVIRONMENT = "prod"

### Step 6.5: Test Lambda → RDS Connectivity

```bash
# Invoke Lambda health check
aws lambda invoke \
  --function-name warmpawz-prod-api-handler \
  --payload '{"path":"/health","httpMethod":"GET"}' \
  response.json

cat response.json

# Check Lambda logs
aws logs tail /aws/lambda/warmpawz-prod-api-handler --follow
```

**Expected:**
- ✅ Lambda executes successfully
- ✅ Can connect to RDS (if health check queries DB)
- ✅ No connection errors in logs

### Step 6.6: Verify Security Group Rules

```bash
# Check dev RDS security group
aws ec2 describe-security-groups \
  --group-ids <DEV_RDS_SG_ID> \
  --query 'SecurityGroups[0].IpPermissions' \
  --output json | jq

# Verify prod Lambda SG is in allowed list
```

### Step 6.7: Verify Razorpay Secret Created in AWS

**⚠️ CRITICAL:** After Terraform apply, verify the Razorpay secret was created.

```bash
# Verify prod Razorpay secret exists
aws secretsmanager describe-secret \
  --secret-id warmpawz/prod/razorpay \
  --region ap-south-1 \
  --query '{Name:Name,ARN:ARN,LastChangedDate:LastChangedDate}' \
  --output json

# Verify secret structure (without exposing values)
aws secretsmanager get-secret-value \
  --secret-id warmpawz/prod/razorpay \
  --region ap-south-1 \
  --query SecretString \
  --output text | jq 'keys'  # Only show keys, not values

# Verify it contains required fields and uses LIVE keys
aws secretsmanager get-secret-value \
  --secret-id warmpawz/prod/razorpay \
  --region ap-south-1 \
  --query SecretString \
  --output text | jq '{has_keyId: (.keyId != null), has_keySecret: (.keySecret != null), keyId_prefix: (.keyId[:8]), is_live_key: (.keyId[:8] == "rzp_live")}'
```

**Expected Results:**
- ✅ Secret exists at: `warmpawz/prod/razorpay`
- ✅ Contains `keyId` field (should start with `rzp_live_...` for production)
- ✅ Contains `keySecret` field
- ✅ Contains `keyId` (camelCase) and `key_id` (snake_case) for compatibility
- ✅ Contains `keySecret` (camelCase) and `key_secret` (snake_case) for compatibility
- ✅ **Key ID MUST start with `rzp_live_...` (NOT `rzp_test_...`)**

**⚠️ CRITICAL VERIFICATION:**
- ✅ Key ID MUST start with `rzp_live_...` (NOT `rzp_test_...`)
- ✅ This is a production secret, so it MUST use live keys
- ❌ If you see `rzp_test_...`, you're using test keys - **FIX THIS IMMEDIATELY**

### Step 6.8: Test Razorpay Configuration in Lambda

```bash
# Test Lambda can access Razorpay secret
aws lambda invoke \
  --function-name warmpawz-prod-api-handler \
  --payload '{"path":"/razorpay/create-order","httpMethod":"POST","body":"{\"bookingId\":\"test\",\"amount\":1000}"}' \
  response.json

cat response.json

# Check Lambda logs for Razorpay config loading
aws logs tail /aws/lambda/warmpawz-prod-api-handler --follow | grep -i razorpay
```

**Expected Log Messages:**
- ✅ `[RAZORPAY-CONFIG] Loaded from AWS Secrets Manager`
- ❌ Should NOT see: `Failed to load from Secrets Manager`
- ❌ Should NOT see: `Razorpay not configured`
- ❌ Should NOT see: `PAYMENT_GATEWAY_NOT_CONFIGURED`

**If Secret is Missing or Incorrect:**
- ❌ Error: `PAYMENT_GATEWAY_NOT_CONFIGURED` (503)
- ❌ Error: `Payment gateway is not configured`
- ❌ Payment endpoints will fail
- ❌ Lambda logs will show fallback attempts and final failure

**If Using TEST Keys (Same as Dev):**
- ⚠️ Payment endpoints will work (no 503 errors)
- ⚠️ But transactions will be in TEST/SANDBOX mode
- ❌ **Real money will NOT be charged**
- ❌ **Real payments will NOT work**
- ✅ Use only for testing/development
- ⚠️ **Switch to LIVE keys before processing real customer payments**

**✅ Checklist:**
- [ ] Terraform plan reviewed and approved
- [ ] Terraform apply completed successfully
- [ ] Lambda created in dev VPC
- [ ] Lambda env vars correct
- [ ] Lambda can connect to dev RDS
- [ ] Security group rules verified
- [ ] **Razorpay secret created in AWS Secrets Manager**
- [ ] **Razorpay secret contains live keys (`rzp_live_...`)**
- [ ] **Lambda can access Razorpay secret**
- [ ] **Payment endpoints work (no 503 errors)**

---

## 🚀 Phase 7: Deployment Execution

### Step 7.1: Pre-Deployment Checklist

- [ ] All Terraform changes applied
- [ ] All GitHub secrets configured
- [ ] Security groups configured
- [ ] Lambda connectivity verified
- [ ] Frontend build tested locally with prod env vars
- [ ] Database migrations tested (dry run)

### Step 7.2: Trigger Production CI/CD

1. Go to GitHub Actions
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Select branch: `main` or `production`
5. Click "Run workflow"

### Step 7.3: Monitor Deployment

**Watch for:**
- ✅ Infrastructure diff step passes
- ✅ Build step completes (frontend with env vars)
- ✅ Terraform plan shows expected changes
- ✅ Terraform apply completes
- ✅ Database migrations run successfully
- ✅ Smoke tests pass
- ✅ Payment validation passes

### Step 7.4: Post-Deployment Verification

```bash
# Get API endpoint
cd infra/envs/prod
terraform output api_endpoint

# Test API health
curl https://api.warmpawz.com/health  # Or use output URL

# Check Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=warmpawz-prod-api-handler \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Step 7.5: Verify Razorpay Secret After Deployment

**⚠️ CRITICAL:** Verify Razorpay secret exists and Lambda can access it.

```bash
# Verify secret exists
aws secretsmanager describe-secret \
  --secret-id warmpawz/prod/razorpay \
  --region ap-south-1

# Test payment endpoint (should NOT return 503)
curl -X POST "https://api.warmpawz.com/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"test","amount":1000}'

# Check Lambda logs for Razorpay config
aws logs filter-log-events \
  --log-group-name /aws/lambda/warmpawz-prod-api-handler \
  --filter-pattern "RAZORPAY-CONFIG" \
  --max-items 10
```

**Expected Results:**
- ✅ Secret exists: `warmpawz/prod/razorpay` (or `warmpawz/dev/razorpay` if using same dev keys)
- ✅ Payment endpoint returns success (NOT 503)
- ✅ Lambda logs show: `[RAZORPAY-CONFIG] Loaded from AWS Secrets Manager`
- ❌ Should NOT see: `PAYMENT_GATEWAY_NOT_CONFIGURED`

**⚠️ Verify Key Type (LIVE vs TEST):**
```bash
# Check if using LIVE or TEST keys
aws secretsmanager get-secret-value \
  --secret-id warmpawz/prod/razorpay \
  --region ap-south-1 \
  --query SecretString \
  --output text | jq '{keyId: .keyId, is_live: (.keyId[:8] == "rzp_live"), is_test: (.keyId[:8] == "rzp_test")}'
```

**Expected:**
- If using LIVE keys: `"is_live": true`, `"is_test": false`
- If using TEST keys: `"is_live": false`, `"is_test": true` ⚠️ **Real payments won't work**

**If Payment Endpoint Returns 503:**
1. Check if secret exists: `aws secretsmanager describe-secret --secret-id warmpawz/prod/razorpay`
2. Check Lambda IAM permissions (should have `secretsmanager:GetSecretValue`)
3. Check Lambda env vars (should have `RAZORPAY_SECRET_ARN`)
4. Check Lambda logs for specific error messages

**✅ Checklist:**
- [ ] CI/CD pipeline completed successfully
- [ ] API endpoint accessible
- [ ] Frontend apps deployed
- [ ] Database migrations applied
- [ ] No errors in CloudWatch logs
- [ ] Lambda invocations working
- [ ] **Razorpay secret exists in AWS Secrets Manager** (or using dev secret)
- [ ] **Razorpay key type verified** (LIVE keys for real payments, or TEST keys if testing)
- [ ] **Payment endpoints work (no 503 errors)**
- [ ] **Lambda can access Razorpay secret (check logs)**
- [ ] **If using TEST keys:** Understand that real payments won't work (test/sandbox only)
- [ ] **If using LIVE keys:** Verified key starts with `rzp_live_...` (not `rzp_test_...`)

---

## 🔄 Rollback Plan

### If Deployment Fails

1. **Terraform Rollback:**
   ```bash
   cd infra/envs/prod
   terraform state list  # See what was created
   terraform destroy -target=module.lambda  # Remove only Lambda if needed
   ```

2. **CI/CD Rollback:**
   - Revert the workflow file changes
   - Re-run previous successful deployment

3. **Database Rollback:**
   - Migrations should be idempotent
   - If needed, manually rollback migrations:
   ```bash
   cd db
   npm run migrate:down
   ```

### If Issues After Deployment

1. **Lambda Issues:**
   - Check CloudWatch logs
   - Verify environment variables
   - Test connectivity to RDS

2. **Frontend Issues:**
   - Verify environment variables in build
   - Check CloudFront distribution
   - Verify S3 bucket contents

3. **Database Issues:**
   - Check RDS connection logs
   - Verify security group rules
   - Test direct connection

---

## 📝 Notes & Considerations

### Important Notes

1. **Shared Resources:**
   - Dev and Prod now share RDS database
   - Dev and Prod now share VPC
   - Consider data isolation strategies if needed
   - Monitor resource usage carefully

2. **Security:**
   - Prod Lambda has access to dev RDS
   - Ensure proper IAM roles and policies
   - Monitor access logs

3. **Costs:**
   - No additional RDS costs (using existing)
   - No additional VPC costs (using existing)
   - Lambda, DynamoDB, S3, etc. are prod-specific

4. **Razorpay Keys:**
   - **Option 1:** Use separate LIVE keys for production (recommended for real payments)
   - **Option 2:** Use same dev TEST keys (acceptable for testing/staging)
   - ⚠️ **CRITICAL:** TEST keys (`rzp_test_...`) will NOT process real payments
   - ⚠️ **CRITICAL:** Only LIVE keys (`rzp_live_...`) can process real money transactions
   - If using same dev keys, understand that all transactions are test/sandbox mode
   - Switch to LIVE keys before processing real customer payments

5. **Future Considerations:**
   - When ready for separate prod RDS, follow reverse process
   - When ready for separate prod VPC, update VPC module
   - When ready for real payments, switch from TEST to LIVE Razorpay keys

### Known Limitations

- Both environments share the same database (data isolation needed at application level)
- Both environments share the same VPC (network isolation needed via security groups)
- Dev and prod deployments may affect each other if not careful
- **If using TEST Razorpay keys:** Real payments will NOT work (test/sandbox only)
- **If using same dev Razorpay keys:** Both environments share payment gateway (test mode)

---

## ✅ Final Checklist

Before considering deployment complete:

- [ ] Phase 1: Information gathering complete
- [ ] Phase 2: Terraform configuration updated
- [ ] Phase 3: CI/CD workflow updated
- [ ] Phase 4: GitHub secrets configured
- [ ] Phase 5: Security groups configured
- [ ] Phase 6: Testing completed
- [ ] Phase 7: Deployment executed successfully
- [ ] Post-deployment verification passed
- [ ] Documentation updated
- [ ] Team notified of changes

---

## 📞 Support & Troubleshooting

### Common Issues

1. **Terraform data source errors:**
   - Verify VPC ID is correct
   - Verify RDS cluster identifier is correct
   - Check AWS credentials and permissions

2. **Lambda can't connect to RDS:**
   - Verify security group rules
   - Check Lambda is in correct VPC/subnets
   - Verify RDS is accessible from Lambda subnets

3. **Frontend build fails:**
   - Verify GitHub secrets are set
   - Check secret names match workflow file
   - Verify Cognito IDs are correct

4. **CI/CD fails:**
   - Check workflow file syntax
   - Verify all required secrets exist
   - Check Terraform state is accessible

### Getting Help

- Check CloudWatch logs for Lambda errors
- Check Terraform state for resource status
- Review GitHub Actions logs for CI/CD errors
- Consult AWS documentation for service-specific issues

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-28  
**Next Review:** After first production deployment
