# Running Production Migrations - Guide

## Overview

This guide explains how to run all pending database migrations on production RDS.

## Prerequisites

1. **AWS CLI configured** with appropriate credentials
2. **Network access** to RDS Proxy (may require VPN or AWS VPN)
3. **Node.js** installed (v14+)
4. **Required npm packages**: `pg`, `@aws-sdk/client-secrets-manager`

## Method 1: Direct Connection (Recommended if you have network access)

### Step 1: Install Dependencies

```bash
cd warmpawzApp/warmpawzaws
npm install pg @aws-sdk/client-secrets-manager
```

### Step 2: Run Migrations

```bash
# Set environment
$env:ENVIRONMENT="prod"

# Dry run first (recommended)
node scripts/run-all-pending-migrations-prod.js --dry-run

# Run actual migrations
node scripts/run-all-pending-migrations-prod.js
```

### Step 3: Verify

The script will automatically verify each migration. Check the output for:
- ✅ Successful migrations
- ⚠️ Skipped migrations (already exist - safe)
- ❌ Failed migrations (needs attention)

## Method 2: Using AWS Systems Manager (If direct connection fails)

If you cannot connect directly to RDS Proxy, use an EC2 instance with SSM access:

### Step 1: Find an EC2 instance in the same VPC

```bash
aws ec2 describe-instances \
  --filters "Name=tag:Environment,Values=prod" \
  --query "Reservations[*].Instances[*].[InstanceId,Tags[?Key=='Name'].Value|[0]]" \
  --output table
```

### Step 2: Copy migration script to EC2

```bash
# Copy script to EC2 instance
aws ssm send-command \
  --instance-ids "i-xxxxxxxxx" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["cd /tmp && git clone <repo-url> || echo \"Repo already exists\""]' \
  --region ap-south-1
```

### Step 3: Run migrations via SSM

```bash
aws ssm send-command \
  --instance-ids "i-xxxxxxxxx" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["cd /path/to/repo && ENVIRONMENT=prod node scripts/run-all-pending-migrations-prod.js"]' \
  --region ap-south-1
```

## Method 3: Using AWS CloudShell

1. Open AWS CloudShell from AWS Console
2. Clone your repository
3. Install dependencies: `npm install pg @aws-sdk/client-secrets-manager`
4. Run: `ENVIRONMENT=prod node scripts/run-all-pending-migrations-prod.js`

## Method 4: Individual Migration Files

If you prefer to run migrations one at a time:

```bash
# Using the existing script
ENVIRONMENT=prod node scripts/run-migration-rds-node.js 536_cancellation_refund_policy_business_rules.sql
ENVIRONMENT=prod node scripts/run-migration-rds-node.js 541_add_missing_booking_columns.sql
# ... continue for each migration
```

## Migrations to Run (in order)

1. ✅ `536_cancellation_refund_policy_business_rules.sql`
2. ✅ `541_add_missing_booking_columns.sql`
3. ✅ `542_add_video_call_sessions_join_tokens.sql`
4. ✅ `544_add_bookings_video_call_columns.sql`
5. ✅ `560_ensure_vendor_profile_columns_prod.sql`
6. ✅ `563_add_prescriptions_general_notes_column.sql`
7. ✅ `564_add_prescriptions_next_follow_up_date_column.sql`
8. ✅ `565_ensure_prescription_date_default_dev.sql`
9. ✅ `600_add_vendor_available_for_instant_tele.sql`
10. ✅ `600_tax_360_mapping.sql`
11. ✅ `602_add_updated_at_to_vendor_documents.sql`
12. ✅ `603_add_code_to_promotions.sql`
13. ✅ `605_add_availability_configured_column.sql`
14. ✅ `607_add_bookings_is_instant_tele.sql`
15. ✅ `608_add_pharmacy_orders_columns.sql` (NEW - from inline code)
16. ✅ `609_add_vendor_availability_v2_columns.sql` (NEW - from inline code)
17. ✅ `610_add_vendor_identity_columns.sql` (NEW - from inline code)
18. ✅ `611_add_vendors_metadata_column.sql` (NEW - from inline code)
19. ✅ `612_add_onboarding_forms_sections.sql` (NEW - from inline code)

## Troubleshooting

### Connection Timeout

**Issue**: `ETIMEDOUT` or connection failures

**Solutions**:
1. Ensure you're connected to VPN (if required)
2. Check security group rules allow your IP
3. Verify RDS Proxy is accessible from your network
4. Try using AWS CloudShell or EC2 instance instead

### Authentication Failed

**Issue**: Password authentication failed

**Solutions**:
1. Verify Secrets Manager secret exists: `warmpawz-prod-rds-master-20260207201049162400000001`
2. Check AWS credentials have `secretsmanager:GetSecretValue` permission
3. Verify RDS cluster name: `warmpawz-prod-cluster`

### Migration Already Exists

**Issue**: "already exists" errors

**Solution**: This is safe! Migrations use `IF NOT EXISTS` and are idempotent. The script will skip these.

### SSL/TLS Errors

**Issue**: SSL connection errors

**Solution**: RDS Proxy requires TLS. The script sets `ssl: { rejectUnauthorized: false }` which should work.

## Verification After Migration

Run these queries to verify migrations:

```sql
-- Check vendors table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vendors' 
AND column_name IN ('available_for_instant_tele', 'availability_configured', 'profile_photo_url', 'metadata')
ORDER BY column_name;

-- Check bookings table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name IN ('is_instant_tele', 'video_call_meeting_id', 'customer_phone', 'pet_id')
ORDER BY column_name;

-- Check pharmacy_orders columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pharmacy_orders' 
AND column_name IN ('subtotal', 'delivery_fee', 'platform_fee', 'tax_amount', 'total_amount')
ORDER BY column_name;
```

## Rollback (if needed)

All migrations are **additive only** (no DROP statements). To rollback:

1. **DO NOT** drop columns with data
2. Instead, mark columns as deprecated in application code
3. Create new migrations to remove columns only after data migration

## Support

If you encounter issues:
1. Check CloudWatch logs for RDS connection errors
2. Verify AWS credentials and permissions
3. Test connection with a simple query first
4. Contact DevOps team for network/VPN access issues

---

**Last Updated**: 2026-02-28  
**Script**: `scripts/run-all-pending-migrations-prod.js`  
**Total Migrations**: 19 files
