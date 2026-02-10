# Production Database Connection Fix

**Date:** 2026-02-09  
**Issue:** Database connection failing with "Database connection check failed"  
**Status:** ✅ RESOLVED

## Root Cause

The production API Gateway `/health` endpoint was returning `503 Service Unavailable` with database connection failures. Investigation revealed two issues:

1. **RDS Proxy TLS Requirement**: The RDS Proxy (`warmpawz-prod-proxy`) requires TLS connections (`RequireTLS: true`), but the Lambda function did not have `DB_SSL=true` set in environment variables.

2. **Missing DB_PORT**: The `DB_PORT` environment variable was not set, defaulting to undefined.

## Error Messages

From CloudWatch logs:
```
ERROR [DB] Initial connection test failed: error: This RDS Proxy requires TLS connections
ERROR [DB] Query error after 282 ms: This RDS Proxy requires TLS connections
ERROR [DB] Error code: 28000
```

## Solution

Updated Lambda function environment variables to include:
- `DB_SSL=true` - Enables TLS/SSL connections required by RDS Proxy
- `DB_PORT=5432` - Explicitly sets PostgreSQL port

**Command executed:**
```bash
aws lambda update-function-configuration \
  --function-name warmpawz-prod-api-handler \
  --region ap-south-1 \
  --environment "Variables={...,DB_SSL=true,DB_PORT=5432}"
```

## Verification

After the fix, the `/health` endpoint returns:
```json
{
  "status": "ok",
  "timestamp": "2026-02-09T10:07:57.610Z",
  "database": {
    "connected": true
  },
  "environment": {
    "valid": true
  }
}
```

## Related Fixes

This fix builds on previous fixes:
1. ✅ Lambda handler corrected (`index.handler` → `handler.handler`)
2. ✅ Security group permissions fixed (Lambda SG added to VPC endpoint SG)
3. ✅ RDS Proxy `statement_timeout` removed (not supported by RDS Proxy)
4. ✅ TLS/SSL enabled for RDS Proxy connections

## Prevention

To prevent this issue in the future:
1. Always set `DB_SSL=true` when using RDS Proxy (which requires TLS)
2. Explicitly set `DB_PORT=5432` in Lambda environment variables
3. Verify RDS Proxy configuration: `aws rds describe-db-proxies --db-proxy-name <name>`
4. Check `RequireTLS` setting - if `true`, SSL must be enabled in connection config

## Code Reference

The SSL configuration is handled in:
- `backend/lambda/src/database/rds-connection.ts` (line 125)
- Checks: `ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false`

When `DB_SSL` is not set or `false`, the connection attempts without TLS, which fails for RDS Proxy with `RequireTLS: true`.
