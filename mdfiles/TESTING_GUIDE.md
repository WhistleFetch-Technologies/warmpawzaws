# Testing Guide - Immediate Fixes

**Date:** 2026-01-28

This guide helps you test the immediate fixes that were implemented.

---

## Quick Test Commands

### 1. Test Environment Validation

```bash
cd backend/lambda

# Option A: Run test script (requires build)
npm run build
npx ts-node test-env-validation.ts

# Option B: Run shell test script
./test-immediate-fixes.sh
```

### 2. Test Health Check Endpoint

```bash
cd backend/lambda

# Start server locally
npm run start:local

# In another terminal, test health endpoint
curl http://localhost:3000/health | jq

# Or use the test script
npx ts-node test-health-endpoint.ts
```

### 3. Test Route Ordering

```bash
# Test specific routes (should work, not return 404)
curl http://localhost:3000/customer/notifications
curl http://localhost:3000/customer/behavior-journal
curl http://localhost:3000/customer/profile

# These should return 200, 401, or 403 (not 404)
# If they return 404, route ordering may be wrong
```

---

## Detailed Test Scenarios

### Test 1: Environment Variable Validation

**Purpose:** Verify that missing environment variables are detected.

**Steps:**

1. **Test with valid environment:**
   ```bash
   export DB_HOST=localhost
   export DB_NAME=warmpawz
   export DB_USER=postgres
   export DB_PASSWORD=password
   
   cd backend/lambda
   npx ts-node test-env-validation.ts
   ```
   
   **Expected:** ✅ Validation passes

2. **Test with missing required variables:**
   ```bash
   unset DB_HOST
   unset DB_NAME
   
   npx ts-node test-env-validation.ts
   ```
   
   **Expected:** ⚠️ Validation fails, lists missing variables

3. **Test database credentials validation:**
   ```bash
   # Test with DB_SECRET_ARN (should pass)
   export DB_SECRET_ARN=arn:aws:secretsmanager:...
   unset DB_USER
   unset DB_PASSWORD
   
   npx ts-node test-env-validation.ts
   ```
   
   **Expected:** ✅ Validation passes (using Secrets Manager)

4. **Test with neither credentials method:**
   ```bash
   unset DB_SECRET_ARN
   unset DB_USER
   unset DB_PASSWORD
   
   npx ts-node test-env-validation.ts
   ```
   
   **Expected:** ❌ Validation fails with credential error

---

### Test 2: Health Check Endpoint

**Purpose:** Verify the enhanced `/health` endpoint returns database and environment status.

**Steps:**

1. **Start the server:**
   ```bash
   cd backend/lambda
   npm run start:local
   ```

2. **Test health endpoint:**
   ```bash
   curl http://localhost:3000/health
   ```

3. **Expected Response (Healthy):**
   ```json
   {
     "status": "ok",
     "timestamp": "2026-01-28T...",
     "database": {
       "connected": true
     },
     "environment": {
       "valid": true
     }
   }
   ```

4. **Expected Response (Degraded - DB down):**
   ```json
   {
     "status": "degraded",
     "timestamp": "2026-01-28T...",
     "database": {
       "connected": false,
       "error": "Database connection timeout or refused..."
     },
     "environment": {
       "valid": true
     }
   }
   ```

5. **Test with invalid environment:**
   ```bash
   # Stop server, remove env vars, restart
   unset DB_HOST
   unset DB_NAME
   npm run start:local
   
   curl http://localhost:3000/health
   ```
   
   **Expected:** Environment validation shows warnings/errors

---

### Test 3: Route Ordering

**Purpose:** Verify specific routes work correctly (not caught by parameterized routes).

**Steps:**

1. **Start the server:**
   ```bash
   cd backend/lambda
   npm run start:local
   ```

2. **Test specific customer routes:**
   ```bash
   # These should NOT return 404 (even if they return 401/403)
   curl -v http://localhost:3000/customer/notifications
   curl -v http://localhost:3000/customer/behavior-journal
   curl -v http://localhost:3000/customer/profile
   ```

3. **Expected Results:**
   - ✅ HTTP 200, 401, or 403 = Route is correctly matched
   - ❌ HTTP 404 = Route may be caught by parameterized route (ordering issue)

4. **Test parameterized route:**
   ```bash
   # This should work with a valid customer ID
   curl -v http://localhost:3000/customer/123e4567-e89b-12d3-a456-426614174000
   ```
   
   **Expected:** Returns customer data or appropriate error (not 404)

---

### Test 4: Duplicate Endpoint Registration

**Purpose:** Verify `registerServiceCatalogEndpoints` is only registered once.

**Steps:**

1. **Check handler file:**
   ```bash
   cd backend/lambda
   grep -n "registerServiceCatalogEndpoints" src/handler/index.ts
   ```
   
   **Expected:** Should appear only once (around line 270)

2. **Verify no duplicate routes:**
   ```bash
   # Count occurrences
   grep -c "registerServiceCatalogEndpoints" src/handler/index.ts
   ```
   
   **Expected:** Output is `1` (only one registration)

---

## Automated Test Script

Run the comprehensive test script:

```bash
cd backend/lambda
./test-immediate-fixes.sh
```

**What it tests:**
- ✅ TypeScript compilation
- ✅ Health check endpoint
- ✅ Route ordering
- ✅ Environment validation

---

## Integration with Existing Tests

### Add to Test Suite

You can add these tests to your existing test suite:

```typescript
// tests/health-check.test.ts
describe('Health Check Endpoint', () => {
  it('should return database status', async () => {
    const response = await fetch('http://localhost:3000/health');
    const data = await response.json();
    expect(data).toHaveProperty('database');
    expect(data.database).toHaveProperty('connected');
  });
  
  it('should return environment validation status', async () => {
    const response = await fetch('http://localhost:3000/health');
    const data = await response.json();
    expect(data).toHaveProperty('environment');
  });
});

// tests/env-validation.test.ts
describe('Environment Validation', () => {
  it('should validate required variables', () => {
    const result = validateEnvironment();
    // Test based on your environment
  });
  
  it('should detect missing database credentials', () => {
    // Test credential validation logic
  });
});
```

---

## Troubleshooting

### Issue: Environment validation fails

**Solution:**
1. Check required environment variables are set
2. Review validation report: `getValidationReport()`
3. Ensure either `DB_SECRET_ARN` OR (`DB_USER` + `DB_PASSWORD`) is set

### Issue: Health check shows database as unhealthy

**Solution:**
1. Verify database is running and accessible
2. Check `DB_HOST`, `DB_NAME` are correct
3. Verify network connectivity (security groups, VPC)
4. Check database credentials are valid

### Issue: Routes return 404

**Solution:**
1. Verify route is registered in `handler/index.ts`
2. Check route ordering (specific before parameterized)
3. Review `ROUTE_ORDERING_GUIDE.md`
4. Test with `curl -v` to see full HTTP response

### Issue: TypeScript compilation fails

**Solution:**
1. Run `npm install` to ensure dependencies
2. Check for import errors
3. Verify `tsconfig.json` is correct
4. Run `npm run build:ts` to see detailed errors

---

## Success Criteria

✅ **All tests pass if:**
1. Environment validation detects missing variables
2. Health endpoint returns database and environment status
3. Specific routes work correctly (not caught by parameterized routes)
4. No duplicate endpoint registrations
5. TypeScript compiles without errors

---

## Next Steps After Testing

1. ✅ Fix any issues found during testing
2. ✅ Add tests to CI/CD pipeline
3. ✅ Monitor health endpoint in production
4. ✅ Document any environment-specific findings

---

**Happy Testing! 🧪**
