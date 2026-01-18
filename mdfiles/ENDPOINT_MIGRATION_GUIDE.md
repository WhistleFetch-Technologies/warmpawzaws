# Endpoint Migration & Testing Guide

## Overview

This guide covers migrating the database schema and testing all 5 newly created endpoints.

## Prerequisites

1. **AWS CLI** installed and configured
2. **PostgreSQL client** (psql) installed
3. **Access to RDS** (security group allows your IP)
4. **Terraform outputs** available (for dev environment)

## Migration Steps

### Step 1: Run Database Migration

The migration creates the `behavior_journal` table if it doesn't exist.

```bash
# Run migration for dev environment
./scripts/migrate-behavior-journal.sh dev

# Or specify region
./scripts/migrate-behavior-journal.sh dev ap-south-1
```

**What it does:**
1. Gets RDS endpoint from AWS CLI or Terraform
2. Retrieves database credentials from Secrets Manager
3. Connects to RDS using psql
4. Runs migration file `055_behavior_journal_table.sql`
5. Verifies table creation

**Migration File:** `db/migrations/055_behavior_journal_table.sql`

**Creates:**
- `behavior_journal` table with all required columns
- Indexes for performance (pet_id, customer_id, created_at, behavior, severity)
- Foreign key constraints to pets and customers tables

### Step 2: Test Endpoints

Test all 5 endpoints to verify they're working:

```bash
# Test endpoints
./scripts/test-endpoints.sh dev

# Or specify region
./scripts/test-endpoints.sh dev ap-south-1
```

**What it tests:**
1. `GET /vendor/reschedule-policy` - Reschedule policy endpoint
2. `GET /vendor/available-slots` - Available slots endpoint
3. `POST /followup/create` - Follow-up appointment creation
4. `GET /customer/behavior-journal` - Get behavior journal entries
5. `POST /behaviorist/journal-entry` - Create behavior journal entry

### Step 3: Complete Workflow

Run both migration and testing in one command:

```bash
./scripts/run-migration-and-test.sh dev
```

## Manual Testing

### Test Reschedule Policy

```bash
curl -X GET "https://YOUR_API_GATEWAY_URL/vendor/reschedule-policy?bookingId=YOUR_BOOKING_ID" \
  -H "Content-Type: application/json"
```

### Test Available Slots

```bash
curl -X GET "https://YOUR_API_GATEWAY_URL/vendor/available-slots?bookingId=YOUR_BOOKING_ID&date=2026-01-15&serviceStyle=at_center" \
  -H "Content-Type: application/json"
```

### Test Follow-up Creation

```bash
curl -X POST "https://YOUR_API_GATEWAY_URL/followup/create" \
  -H "Content-Type: application/json" \
  -d '{
    "originalBookingId": "YOUR_BOOKING_ID",
    "customerPhone": "1234567890",
    "vendorId": "YOUR_VENDOR_ID",
    "serviceId": "YOUR_SERVICE_ID",
    "selectedDate": "2026-01-15",
    "selectedTime": "10:00",
    "petId": "YOUR_PET_ID",
    "address": "123 Main St",
    "serviceStyle": "at_center"
  }'
```

### Test Behavior Journal - Get

```bash
curl -X GET "https://YOUR_API_GATEWAY_URL/customer/behavior-journal?petId=YOUR_PET_ID&limit=10" \
  -H "Content-Type: application/json"
```

### Test Behavior Journal - Create

```bash
curl -X POST "https://YOUR_API_GATEWAY_URL/behaviorist/journal-entry" \
  -H "Content-Type: application/json" \
  -d '{
    "petId": "YOUR_PET_ID",
    "customerId": "YOUR_CUSTOMER_ID",
    "behavior": "Barking",
    "triggers": ["Strangers", "Loud noises"],
    "duration": "5 minutes",
    "severity": "medium",
    "notes": "Occurs when doorbell rings"
  }'
```

## Verification

### Verify Table Exists

```bash
# Connect to RDS
psql -h YOUR_RDS_ENDPOINT -U YOUR_USERNAME -d YOUR_DATABASE

# Check table
\dt behavior_journal

# Check structure
\d behavior_journal

# Check indexes
\di idx_behavior_journal*

# Count entries
SELECT COUNT(*) FROM behavior_journal;
```

### Verify Endpoints are Registered

Check Lambda handler logs or API Gateway to verify endpoints are accessible.

## Troubleshooting

### Migration Fails

1. **Connection Error:**
   - Check RDS security group allows your IP
   - Verify RDS endpoint is correct
   - Check credentials in Secrets Manager

2. **Table Already Exists:**
   - Migration uses `CREATE TABLE IF NOT EXISTS` - safe to rerun
   - Check if table structure matches expected schema

3. **Permission Error:**
   - Verify database user has CREATE TABLE permissions
   - Check user has access to create indexes

### Endpoint Tests Fail

1. **404 Not Found:**
   - Endpoints may not be deployed to Lambda yet
   - Check API Gateway routes are configured
   - Verify handler registration in `backend/lambda/src/handler/index.ts`

2. **500 Server Error:**
   - Check Lambda logs in CloudWatch
   - Verify database connection in Lambda
   - Check table exists (run migration)

3. **400 Bad Request:**
   - Verify request body format
   - Check required fields are provided
   - Validate data types match schema

## Files Created

1. **Migration:** `db/migrations/055_behavior_journal_table.sql`
2. **Migration Script:** `scripts/migrate-behavior-journal.sh`
3. **Test Script:** `scripts/test-endpoints.sh`
4. **Complete Workflow:** `scripts/run-migration-and-test.sh`

## Next Steps

After successful migration and testing:

1. ✅ Deploy Lambda function with new endpoints
2. ✅ Update API Gateway routes
3. ✅ Monitor CloudWatch logs
4. ✅ Test with real data
5. ✅ Update API documentation
