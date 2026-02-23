# Dev/UAT Vendor Discovery Fix — No Vendors Returned

## Date: 2026-02-23

---

## Problem

The dev/UAT API returned **0 vendors** for all service styles (`tele`, `at_home`, `at_center`):

```
GET https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=tele&category=vet&roleId=veterinarian
→ { "success": true, "providers": [], "total": 0 }
```

All three endpoints returned empty results:
- `/customer/services/by-style?style=tele` → 0 providers
- `/customer/services/by-style?style=at_home` → 0 providers
- `/customer/discover-services?serviceStyle=at_center` → 0 vendors

**Production was NOT affected** — prod continued returning vendors correctly.

---

## Environment Architecture

| Property | Dev/UAT | Production |
|----------|---------|------------|
| Lambda Function | `warmpawz-api-dev-api` | `warmpawz-prod-api-handler` |
| API Gateway | `z0b3obweb6` | `mss9sa4y01` |
| DB Host | `warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com` | `warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com` |
| DB Name | `warmpawz` | `warmpawz` |
| NODE_ENV | `dev` | `production` |
| UAT_MODE | `true` | (not set) |

**Key Fact:** Dev/UAT and prod use **separate databases** but the **same backend codebase** (same `service-discovery.ts`). Any code fix must work correctly in both environments.

---

## Root Causes (2 found)

### Root Cause 1: Availability Filtering Blocks All Dev Vendors

**Symptoms:** CloudWatch logs showed:
```
[Services By Style] Vendor fallback found 35 vendors
[by-style] fallback: vendor 0b77c3e5-... filtered - no availability set
[by-style] fallback: vendor 11b5e245-... filtered - no availability set
... (all 35 vendors filtered out)
```

**Why:** The `getNextAvailableSlot()` function queries the `vendor_availability_v2` table. In the dev database, **no vendors have availability records** configured, so `getNextAvailableSlot()` returns `null` for every vendor. The code then filters them ALL out.

**Affected Code Locations (7 total in `service-discovery.ts`):**

| # | Location | Endpoint | Line (approx) |
|---|----------|----------|----------------|
| 1 | Individual providers filter | `by-style` at_home/tele | ~5762 |
| 2 | Staff providers filter | `by-style` at_home/tele | ~5966 |
| 3 | Vendor_identity providers filter | `by-style` at_home/tele | ~6103 |
| 4 | Fallback vendors filter | `by-style` at_home/tele | ~6381 |
| 5 | `at_center` filtered vendors | `by-style` at_center | ~5438 |
| 6 | Solo vendors in `discover-services` | `discover-services` | ~1425 |
| 7 | At_center post-query filter | `discover-services` | ~2037 |
| 8 | At_home/tele post-query filter | `discover-services` | ~2044 |

### Root Cause 2: Missing `profile_photo_url` Column on `vendor_identity`

**Symptoms:**
```
ERROR [Services By Style] Vendor identity query error: 
  error: column vi.profile_photo_url does not exist
```

**Why:** The dev database's `vendor_identity` table does not have a `profile_photo_url` column (it exists in prod). The SQL query `SELECT vi.profile_photo_url ...` crashes with error code `42703`, and the `.catch()` block returns `{ rows: [] }`, yielding 0 vendor_identity providers.

**Affected Code Location:**
- `service-discovery.ts`, Section "3. SOLO PROVIDERS FROM VENDOR_IDENTITY", line ~6027

---

## Fix Applied

### Fix 1: `isProductionEnvironment()` Helper Function

Added a helper function at line ~42 of `service-discovery.ts`:

```typescript
function isProductionEnvironment(): boolean {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME || '';
  const nodeEnv = process.env.NODE_ENV || '';
  const stage = process.env.STAGE || '';
  return (
    (functionName.includes('prod') && !functionName.includes('dev') && !functionName.includes('uat')) ||
    nodeEnv === 'production' ||
    stage === 'prod'
  );
}
```

**Environment Detection Logic:**

| Env Var | Dev/UAT Value | Prod Value | Result |
|---------|---------------|------------|--------|
| `AWS_LAMBDA_FUNCTION_NAME` | `warmpawz-api-dev-api` | `warmpawz-prod-api-handler` | Dev: `false`, Prod: `true` |
| `NODE_ENV` | `dev` | `production` | Dev: `false`, Prod: `true` |
| `STAGE` | (not set) | (not set) | N/A |

### Fix 2: Conditional Availability Filtering (PROD only)

Changed all 8 availability filter locations from:
```typescript
// OLD: Always filter
if (!nextAvailable) {
  console.log('... filtered - no availability set');
  continue;
}
```

To:
```typescript
// NEW: Only filter in PROD; dev/UAT allows vendors without availability
if (isProductionEnvironment() && !nextAvailable) {
  console.log('... filtered - no availability set (PROD)');
  continue;
}
```

**All 8 locations changed:**

1. **Individual providers** (`by-style` endpoint):
```typescript
if (isProductionEnvironment() && !indNextAvailable) {
  console.log(`[by-style] at_home/tele: individual ${ind.id} filtered - no availability set (PROD)`);
  continue;
}
```

2. **Staff providers** (`by-style` endpoint):
```typescript
if (isProductionEnvironment() && !staffNextAvailable) {
  console.log(`[by-style] at_home/tele: staff ${staff.id} (vendor ${staff.vendor_id}) filtered - no availability set (PROD)`);
  continue;
}
```

3. **Vendor_identity providers** (`by-style` endpoint):
```typescript
if (isProductionEnvironment() && !viNextAvailable) {
  console.log(`[by-style] vendor_identity ${vi.vendor_id} filtered - no availability set (PROD)`);
  continue;
}
```

4. **Fallback vendors** (`by-style` endpoint):
```typescript
if (isProductionEnvironment() && !vendorFallbackNextAvailable) {
  console.log(`[by-style] fallback: vendor ${vendor.vendor_id} filtered - no availability set (PROD)`);
  continue;
}
```

5. **At_center filtered vendors** (`by-style` endpoint):
```typescript
if (isProductionEnvironment() && !v.nextAvailable) {
  console.log(`[by-style] at_center: vendor ${v.vendorId} filtered - no availability set (PROD)`);
  return false;
}
```

6. **Solo vendors** (`discover-services` endpoint):
```typescript
if (isProductionEnvironment() && !nextAvailableSlot) {
  console.log('[discover-services] %s: vendor %s filtered - no availability set (PROD)', serviceStyle, vendor.id);
  continue;
}
```

7. **At_center post-query filter** (`discover-services` endpoint):
```typescript
return hasBusinessName && hasServices && (isProductionEnvironment() ? hasNextAvailability : true);
```

8. **At_home/tele post-query filter** (`discover-services` endpoint):
```typescript
return hasPhoto && (isProductionEnvironment() ? hasNextAvailability : true) && hasProfileInfo && hasCompleteServices;
```

### Fix 3: Dynamic Column Detection for `vendor_identity.profile_photo_url`

Used the existing `columnExists()` utility to check if the column exists before referencing it:

```typescript
// Before the vendor_identity query:
const hasViProfilePhoto = await columnExists('vendor_identity', 'profile_photo_url');
const viPhotoCol = hasViProfilePhoto ? 'vi.profile_photo_url' : 'NULL';

// In the SQL query:
let vendorIdentityQuery = `
  SELECT DISTINCT
    vi.id as vendor_id,
    ...
    ${viPhotoCol} as profile_photo_url,
    ...
`;
```

**How `columnExists` works** (defined at line ~209):
```typescript
const columnExistsCache = new Map<string, boolean>();
async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  const key = `${tableName}.${columnName}`;
  if (columnExistsCache.has(key)) return columnExistsCache.get(key) as boolean;
  
  const result = await query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
    ) as exists`,
    [tableName, columnName]
  );
  const exists = result.rows?.[0]?.exists === true;
  columnExistsCache.set(key, exists);
  return exists;
}
```

This pattern is already used for `vendors.logo_url` at 3 other locations in the same file.

---

## Deployment

### Steps Taken

1. **Modified** `service-discovery.ts` with all 3 fixes
2. **Built** Lambda: `npm run build:bundle` (generates `dist/handler.js`)
3. **Created zip** manually: `Compress-Archive -Path dist\handler.js -DestinationPath dist\handler.zip -Force`
4. **Deployed** to dev Lambda only: `aws lambda update-function-code --function-name warmpawz-api-dev-api --zip-file fileb://dist/handler.zip`

### ⚠️ CRITICAL DEPLOYMENT NOTE

The `npm run build:bundle` command only generates `dist/handler.js`. It does **NOT** create or update any zip file.

The zip files are:
- `dist/handler.zip` — used for manual deployments (must be created manually)
- `api-handler.zip` — created by `npm run package` (zips everything in `dist/`)

**After running `npm run build:bundle`, you MUST recreate the zip before deploying:**
```powershell
Compress-Archive -Path dist\handler.js -DestinationPath dist\handler.zip -Force
```

Otherwise you'll deploy stale code.

### Environment Variables Required for Dev Lambda

```json
{
  "DB_HOST": "warmpawz-dev-instance-1.cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com",
  "DB_NAME": "warmpawz",
  "DB_PORT": "5432",
  "DB_USER": "warmpawz_admin",
  "DB_PASSWORD": "<from Secrets Manager>",
  "DB_SECRET_ARN": "arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI",
  "UAT_MODE": "true",
  "NODE_ENV": "dev",
  "S3_UPLOADS_BUCKET": "warmpawz-dev-uploads"
}
```

**⚠️ WARNING:** Do NOT use `aws lambda update-function-configuration --environment` to force Lambda restarts — it replaces ALL environment variables. If you must update config, ensure ALL variables above are included.

---

## Verification Results

### After Fix:
| Endpoint | Dev/UAT Result | Prod Result |
|----------|---------------|-------------|
| `by-style?style=tele` | **35 providers** ✅ | 1 provider ✅ |
| `by-style?style=at_home` | **33 providers** ✅ | (unchanged) ✅ |
| `discover-services?serviceStyle=at_center` | **20 vendors** ✅ | (unchanged) ✅ |

### Before Fix:
| Endpoint | Dev/UAT Result | Prod Result |
|----------|---------------|-------------|
| `by-style?style=tele` | **0 providers** ❌ | 1 provider ✅ |
| `by-style?style=at_home` | **0 providers** ❌ | (working) ✅ |
| `discover-services?serviceStyle=at_center` | **0 vendors** ❌ | (working) ✅ |

---

## Database Schema Differences (Dev vs Prod)

| Table | Column | Dev | Prod |
|-------|--------|-----|------|
| `vendor_identity` | `profile_photo_url` | ❌ Missing | ✅ Exists |
| `vendor_availability_v2` | (records) | ❌ No data | ✅ Has data |
| `vendors` | `profile_photo_url` | ✅ Exists | ✅ Exists |
| `vendors` | `logo_url` | ✅ Exists | ✅ Exists |

### To Add Missing Column in Dev:
```sql
ALTER TABLE vendor_identity ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
```
This is optional — the code now handles the missing column dynamically via `columnExists()`.

---

## How This Should Work in Dev/UAT Mode

1. **Vendors appear WITHOUT availability configured** — availability filtering is skipped
2. **`nextAvailable` field will be `null`/empty** on vendor cards — this is expected
3. **Missing DB columns** are detected dynamically and replaced with `NULL`
4. **All existing prod behavior is preserved** — the `isProductionEnvironment()` check ensures prod-only filtering

---

## Files Changed

| File | Change |
|------|--------|
| `backend/lambda/src/endpoints/service-discovery.ts` | Added `isProductionEnvironment()` helper; made 8 availability checks PROD-only; added `columnExists` check for `vendor_identity.profile_photo_url` |

**No other files were changed. No database migrations were needed.**

---

## Quick Reference for Future Issues

### If dev/UAT returns 0 vendors:
1. Check CloudWatch logs: `aws logs tail /aws/lambda/warmpawz-api-dev-api --since 5m --filter-pattern "Services By Style"`
2. Look for "filtered" messages → availability filtering issue
3. Look for "does not exist" → missing column issue
4. Verify `isProductionEnvironment()` returns `false` in dev

### If prod filters too aggressively:
1. Verify `NODE_ENV=production` is set on prod Lambda
2. Verify `AWS_LAMBDA_FUNCTION_NAME` contains `prod`
3. Check `vendor_availability_v2` table has records for the vendor

### Deployment checklist:
1. `cd backend/lambda`
2. `npm run build:bundle`
3. `Compress-Archive -Path dist\handler.js -DestinationPath dist\handler.zip -Force`
4. `aws lambda update-function-code --function-name warmpawz-api-dev-api --zip-file fileb://dist/handler.zip`
5. Wait 10-20 seconds for cold start
6. Verify: `Invoke-RestMethod -Uri "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/by-style?style=tele&category=vet&roleId=veterinarian"`
