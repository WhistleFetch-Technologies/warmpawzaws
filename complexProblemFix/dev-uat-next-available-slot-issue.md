# Dev/UAT Next Available Slot Feature Not Working - Investigation & Fix

## Problem Statement

The "Next Available Slot" feature works correctly in **production** but does not appear in **dev/UAT mode**. The feature should work identically in both environments since they share the same codebase.

## Root Cause Analysis

### 1. Different API Endpoints

**Production API**: `https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com`  
**Dev/UAT API**: `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`

These are **different API Gateway endpoints** pointing to **different Lambda functions**.

### 2. Lambda Function Deployment Status

The code changes for `getNextAvailableSlot()` were deployed to:
- ✅ **Production Lambda**: `warmpawz-prod-api-handler`
- ❌ **Dev Lambda**: Likely not deployed or pointing to old code

### 3. Code Analysis

The `getNextAvailableSlot()` function in `service-discovery.ts` has **NO environment-specific conditions**. It should work identically in dev and prod:

```typescript
async function getNextAvailableSlot(
  vendorId: string,
  phone: string,
  serviceStyleFilter?: string[]
): Promise<{ date: string; time: string; display: string } | null> {
  // No environment checks - works in all environments
  // ...
}
```

### 4. Possible Issues

#### Issue A: Dev Lambda Not Deployed
- Dev Lambda function may not have the latest code
- Solution: Deploy Lambda to dev environment

#### Issue B: Dev Database Missing Data
- `vendor_availability_v2` table may be empty in dev
- Solution: Verify and populate dev database

#### Issue C: Different Lambda Function Name
- Dev Lambda may have a different function name
- Solution: Identify and deploy to correct dev Lambda

## Investigation Steps

### Step 1: Identify Dev Lambda Function Name

```bash
# Check which Lambda function the dev API Gateway points to
aws apigatewayv2 get-integrations \
  --api-id z0b3obweb6 \
  --region ap-south-1

# Or check API Gateway stages
aws apigatewayv2 get-stages \
  --api-id z0b3obweb6 \
  --region ap-south-1
```

**Expected Output**: Lambda function ARN like `arn:aws:lambda:ap-south-1:ACCOUNT:function:warmpawz-dev-api-handler`

### Step 2: Verify Dev Lambda Code

```bash
# List all Lambda functions
aws lambda list-functions --region ap-south-1 | grep -i "warmpawz.*api"

# Check if dev Lambda exists
aws lambda get-function \
  --function-name warmpawz-dev-api-handler \
  --region ap-south-1
```

### Step 3: Check Dev Database

```sql
-- Connect to dev database and check vendor_availability_v2
SELECT COUNT(*) FROM vendor_availability_v2;

-- Check if any vendors have availability
SELECT v.id, v.business_name, COUNT(va.id) as availability_count
FROM vendors v
LEFT JOIN vendor_availability_v2 va ON va.vendor_id = v.id
GROUP BY v.id, v.business_name
HAVING COUNT(va.id) > 0
LIMIT 10;
```

### Step 4: Test Dev API Endpoint

```bash
# Test the dev API endpoint directly
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&category=vet" \
  -H "Content-Type: application/json"

# Check if nextAvailable is in response
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&category=vet" \
  | jq '.providers[0].nextAvailable'
```

**Expected**: Should return `{ "date": "...", "time": "...", "display": "..." }` or `null`

## Solution: Deploy Lambda to Dev Environment

### Option 1: Deploy to Dev Lambda (Recommended)

If dev Lambda function name is `warmpawz-dev-api-handler`:

```powershell
# Navigate to Lambda directory
cd D:\WFTPL\warmpawzApp\warmpawzaws\backend\lambda

# Build the Lambda
npm run build:bundle

# Create deployment package
Compress-Archive -Path dist\handler.js -DestinationPath dist\lambda-dev.zip -Force

# Deploy to dev Lambda
aws lambda update-function-code `
  --function-name warmpawz-dev-api-handler `
  --zip-file fileb://dist/lambda-dev.zip `
  --region ap-south-1
```

### Option 2: Identify Dev Lambda Function Name First

```powershell
# Find the Lambda function name from API Gateway
$apiId = "z0b3obweb6"
$region = "ap-south-1"

# Get API Gateway integrations
$integrations = aws apigatewayv2 get-integrations --api-id $apiId --region $region | ConvertFrom-Json

# Extract Lambda function ARN
$lambdaArn = $integrations.Items[0].IntegrationUri
$lambdaName = $lambdaArn -replace '.*function:', ''

Write-Host "Dev Lambda Function Name: $lambdaName"

# Then deploy
aws lambda update-function-code `
  --function-name $lambdaName `
  --zip-file fileb://dist/lambda-dev.zip `
  --region $region
```

### Option 3: Verify Database Schema in Dev

```sql
-- Check if vendor_availability_v2 table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'vendor_availability_v2'
);

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vendor_availability_v2'
ORDER BY ordinal_position;

-- Check if service_styles column exists (added in migration 500)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'vendor_availability_v2' 
AND column_name = 'service_styles';
```

## Verification Steps

### 1. Verify Lambda Deployment

```bash
# Check Lambda function last modified time
aws lambda get-function \
  --function-name warmpawz-dev-api-handler \
  --region ap-south-1 \
  --query 'Configuration.LastModified'
```

### 2. Test API Response

```bash
# Call dev API and verify nextAvailable exists
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home&category=vet" \
  | jq '.providers[] | {name, nextAvailable}'
```

**Expected Output**:
```json
{
  "name": "Vendor Name",
  "nextAvailable": {
    "date": "2026-02-22",
    "time": "14:00",
    "display": "Today 2:00 PM"
  }
}
```

### 3. Check Frontend Display

1. Open dev customer web app: `http://localhost:3001` (or dev URL)
2. Navigate to "Home Visit" services
3. Verify provider cards show "Next: Today 2:00 PM" (or similar)
4. Check browser console for API calls to dev endpoint

### 4. Verify Database Data

```sql
-- Check if vendors have availability records
SELECT 
  v.id,
  v.business_name,
  COUNT(va.id) as slot_count,
  array_agg(DISTINCT va.service_style) as service_styles
FROM vendors v
LEFT JOIN vendor_availability_v2 va ON va.vendor_id = v.id
WHERE v.status = 'approved'
GROUP BY v.id, v.business_name
HAVING COUNT(va.id) > 0
LIMIT 10;
```

## Common Issues & Fixes

### Issue 1: Lambda Function Not Found

**Error**: `Function not found: warmpawz-dev-api-handler`

**Solution**: Identify correct function name:
```bash
aws lambda list-functions --region ap-south-1 \
  | jq '.Functions[] | select(.FunctionName | contains("warmpawz") and contains("api")) | .FunctionName'
```

### Issue 2: No Availability Data in Dev Database

**Symptom**: API returns providers but `nextAvailable` is always `null`

**Solution**: Populate dev database:
```sql
-- Insert test availability for a vendor
INSERT INTO vendor_availability_v2 (
  vendor_id, 
  day_of_week, 
  start_time, 
  end_time, 
  service_style,
  service_styles,
  is_available
) VALUES (
  'vendor-uuid-here',
  3, -- Wednesday
  '09:00',
  '17:00',
  'at_home',
  ARRAY['at_home'],
  true
);
```

### Issue 3: Frontend Still Shows Old Behavior

**Symptom**: API returns `nextAvailable` but UI doesn't display it

**Solution**: 
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Verify frontend is calling dev API endpoint
4. Check browser console for errors

### Issue 4: Different Database Connection

**Symptom**: Lambda deployed but still no data

**Solution**: Verify Lambda environment variables point to dev database:
```bash
aws lambda get-function-configuration \
  --function-name warmpawz-dev-api-handler \
  --region ap-south-1 \
  --query 'Environment.Variables'
```

## Automated Fix Script

Create `deploy-lambda-dev.ps1`:

```powershell
# ============================================================================
# Deploy Lambda to Dev Environment
# ============================================================================

param(
    [string]$Region = "ap-south-1"
)

$ErrorActionPreference = "Stop"

Write-Host "Deploying Lambda to Dev Environment" -ForegroundColor Cyan
Write-Host ""

# Step 1: Identify Dev Lambda Function
Write-Host "Step 1: Identifying Dev Lambda Function..." -ForegroundColor Yellow
$apiId = "z0b3obweb6"

try {
    $integrations = aws apigatewayv2 get-integrations --api-id $apiId --region $Region --output json | ConvertFrom-Json
    $lambdaArn = $integrations.Items[0].IntegrationUri
    $lambdaName = $lambdaArn -replace '.*function:', ''
    Write-Host "Found Lambda Function: $lambdaName" -ForegroundColor Green
} catch {
    Write-Host "Could not auto-detect Lambda function. Using default: warmpawz-dev-api-handler" -ForegroundColor Yellow
    $lambdaName = "warmpawz-dev-api-handler"
}

# Step 2: Build Lambda
Write-Host ""
Write-Host "Step 2: Building Lambda..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\..\lambda"
npm run build:bundle

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Step 3: Create Deployment Package
Write-Host ""
Write-Host "Step 3: Creating deployment package..." -ForegroundColor Yellow
Compress-Archive -Path dist\handler.js -DestinationPath dist\lambda-dev.zip -Force

# Step 4: Deploy to Dev Lambda
Write-Host ""
Write-Host "Step 4: Deploying to $lambdaName..." -ForegroundColor Yellow
$result = aws lambda update-function-code `
    --function-name $lambdaName `
    --zip-file fileb://dist/lambda-dev.zip `
    --region $Region `
    --output json | ConvertFrom-Json

if ($result.LastModified) {
    Write-Host "Deployment successful!" -ForegroundColor Green
    Write-Host "Last Modified: $($result.LastModified)" -ForegroundColor Green
    Write-Host "Code Size: $($result.CodeSize) bytes" -ForegroundColor Green
} else {
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Lambda deployed to dev environment!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Test API: https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=at_home"
Write-Host "2. Verify nextAvailable appears in response"
Write-Host "3. Check frontend displays 'Next: ...' on provider cards"
```

## Testing Checklist

- [ ] Dev Lambda function identified
- [ ] Lambda code deployed to dev
- [ ] Dev database has `vendor_availability_v2` table
- [ ] Dev database has availability records for test vendors
- [ ] Dev API returns `nextAvailable` in response
- [ ] Frontend displays "Next: ..." on provider cards
- [ ] Vendors without availability are filtered out
- [ ] Display format is correct (Today/Tomorrow/Weekday/Date)

## Prevention

To prevent this issue in the future:

1. **Always deploy to both environments**: Create deployment scripts for both dev and prod
2. **Environment parity**: Ensure dev database schema matches prod
3. **Automated testing**: Add integration tests that verify feature works in both environments
4. **Deployment checklist**: Document which Lambda functions need updates

## Related Files

- **Backend**: `warmpawzApp/warmpawzaws/backend/lambda/src/endpoints/service-discovery.ts`
  - `getNextAvailableSlot()` function: Lines 445-522
  - Integration points: Lines 5344, 5746, 5950, 6088, 6366

- **Frontend**: `warmpawzApp/warmpawzaws/apps/customer-web/components/customer/shared/UniversalServiceProviderList.tsx`
  - Data mapping: Lines 620-631
  - UI display: Lines 426-431

- **Database**: `warmpawzApp/warmpawzaws/db/migrations/057_vendor_capabilities_tables.sql`
  - Table creation: Lines 145-156

## Summary

The issue is that **dev Lambda function was not deployed** with the latest code containing `getNextAvailableSlot()`. The fix is to:

1. Identify the dev Lambda function name
2. Build the Lambda code
3. Deploy to dev Lambda function
4. Verify the API response includes `nextAvailable`
5. Test the frontend display

The code itself has no environment-specific conditions, so once deployed, it should work identically in dev and prod.
