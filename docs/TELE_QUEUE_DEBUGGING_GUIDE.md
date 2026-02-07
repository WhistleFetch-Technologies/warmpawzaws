# Tele Queue 500 Error - Quick Debugging Guide

## Quick Start

### 1. Run Comprehensive Diagnostics

```bash
node scripts/debug-tele-queue-500.js
```

This single command checks everything:
- ✅ Migration 216 status
- ✅ Database schema
- ✅ Table constraints
- ✅ Recent CloudWatch logs
- ✅ Service schema compatibility

**Output:** Clear summary with recommended actions

### 2. Check Migration Status Only

```bash
node scripts/check-migration-216-status.js
```

Quick check if migration 216 is applied (vendor_id column exists, staff_id is nullable).

### 3. View Recent Error Logs

```bash
./scripts/check-tele-queue-logs.sh
```

Shows recent tele queue errors from CloudWatch (last 30 minutes by default).

### 4. Apply Migration 216 (if needed)

```bash
node scripts/run-migration-216-tele-queue-vendor-support.js
```

Applies the migration to support solo vendors in tele queue.

### 5. Test Queue Join

```bash
node scripts/test-tele-queue-join.js
```

Tests the queue join endpoint with available providers.

## Common Issues & Solutions

### Issue: Migration 216 Not Applied

**Symptoms:**
- Error: "Database migration required"
- Error: "null value in column staff_id"
- vendor_id column missing

**Solution:**
```bash
node scripts/run-migration-216-tele-queue-vendor-support.js
```

### Issue: UUID Type Mismatch

**Symptoms:**
- Error: "operator does not exist: uuid = text"
- Error: "invalid input syntax for type uuid"

**Solution:**
- ✅ Already fixed in latest code (explicit UUID casting)
- Deploy latest backend code
- Verify request payload has valid UUIDs

### Issue: Provider Not Available

**Symptoms:**
- Error: "Provider is not currently available"
- 400 status code

**Solution:**
- Check if provider has tele services enabled
- Verify provider is active and approved
- Check `staff_tele_availability` or `vendor_services` table

### Issue: Service Not Found

**Symptoms:**
- Error: "Service not found"
- 404 status code

**Solution:**
- Verify service exists in database
- Check service is enabled and published
- Verify service_style is 'tele'

## Environment-Specific Usage

### Development
```bash
ENVIRONMENT=dev node scripts/debug-tele-queue-500.js
```

### Production
```bash
ENVIRONMENT=prod node scripts/debug-tele-queue-500.js
```

### Custom Region
```bash
AWS_REGION=us-east-1 ENVIRONMENT=prod node scripts/debug-tele-queue-500.js
```

## AWS CLI Requirements

The scripts use AWS CLI for:
- RDS cluster information
- Secrets Manager (database credentials)
- CloudWatch logs

**Prerequisites:**
```bash
# Install AWS CLI
brew install awscli  # macOS
# or
apt-get install awscli  # Linux

# Configure credentials
aws configure
```

## Database Access

The scripts connect directly to RDS. If you get connection timeouts:

**Option 1: Run from VPC**
- EC2 instance in the VPC
- Bastion host
- VPN connection

**Option 2: Use AWS RDS Query Editor**
- No VPC access needed
- Run SQL queries directly in AWS Console

**Option 3: Port Forwarding**
```bash
# Set up SSH tunnel to RDS
ssh -L 5432:rds-endpoint:5432 ec2-bastion-host
```

## Troubleshooting

### Script Fails: "RDS cluster not found"
- Check environment variable: `ENVIRONMENT=dev`
- Verify cluster name: `warmpawz-{env}-cluster`
- Check AWS region

### Script Fails: "Connection timeout"
- Database is in VPC - use one of the access methods above
- Check security group allows your IP
- Verify RDS endpoint is correct

### Script Fails: "Secret not found"
- Check secret name: `warmpawz-{env}-rds-master-*`
- Verify AWS credentials have Secrets Manager access
- Check region matches

### CloudWatch Logs Not Showing
- Verify log group: `/aws/lambda/warmpawz-api-{env}-api`
- Check AWS credentials have CloudWatch Logs access
- Verify region matches
- Check if logs exist in the time range

## Next Steps After Debugging

1. **If Migration Needed:**
   - Run migration script
   - Verify migration success
   - Test queue join again

2. **If Code Issue:**
   - Deploy latest backend code
   - Check error logs for specific error code
   - Verify request payload format

3. **If Data Issue:**
   - Verify provider exists and is active
   - Check service is enabled
   - Verify customer/pet IDs are valid

4. **If Still Failing:**
   - Check CloudWatch logs for detailed error context
   - Review error response for specific error code
   - Contact backend team with error details

## Script Output Examples

### Migration 216 Applied ✅
```
✅ Migration 216 is FULLY APPLIED!
✅ All required changes are in place.
   The tele queue should support solo vendors.
```

### Migration 216 Not Applied ❌
```
❌ Migration 216 is NOT FULLY APPLIED
🔧 To apply migration 216, run:
   node scripts/run-migration-216-tele-queue-vendor-support.js
⚠️  Without this migration, solo vendors cannot join the tele queue.
```

### Diagnostic Summary
```
╔════════════════════════════════════════════════════════════╗
║   Diagnostic Summary                                       ║
╚════════════════════════════════════════════════════════════╝

Migration 216 Status: ✅ Applied
Table Data Check: ✅ Passed
Schema Check: ✅ Passed
```

## Additional Resources

- Full error analysis: `docs/TELE_QUEUE_500_ERROR_ANALYSIS.md`
- Migration script: `scripts/run-migration-216-tele-queue-vendor-support.js`
- Test script: `scripts/test-tele-queue-join.js`
- Backend endpoint: `backend/lambda/src/endpoints/instant-tele-queue.ts`
