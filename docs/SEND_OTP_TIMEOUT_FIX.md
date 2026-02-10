# Send OTP Timeout Fix - Complete

## Problem

The `/auth/send-otp` endpoint was timing out with the error:
```
Error: Request timed out. Please try again.
```

**Root Cause:**
- API Gateway HTTP API has a **30-second hard timeout limit**
- The send-otp handler was taking too long due to:
  1. Database query to get platform_settings (no timeout)
  2. SNS SMS sending (no timeout, could hang)
  3. Sequential operations blocking the response

## Solution Applied

### 1. Added Timeouts to Database Queries
**File:** `backend/lambda/src/endpoints/auth-enhanced.ts`

- Added 2-second timeout for fetching SMS settings from database
- Added 3-second timeout for storing OTP in database
- Uses `Promise.race()` to enforce timeouts

```typescript
// Database query timeout (2 seconds)
const dbTimeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error('Database query timeout for SMS settings')), 2000);
});
const settings = await Promise.race([settingsPromise, dbTimeoutPromise]);
```

### 2. Added Timeout to SNS SMS Sending
**File:** `backend/lambda/src/endpoints/auth-enhanced.ts`

- Added 5-second timeout for SNS SMS sending
- Wraps SNS call with `Promise.race()` to prevent hanging

```typescript
// SNS send timeout (5 seconds)
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error('SNS send timeout after 5 seconds')), SMS_TIMEOUT_MS);
});
await Promise.race([snsSendPromise, timeoutPromise]);
```

### 3. Made SMS Sending Non-Blocking
**File:** `backend/lambda/src/endpoints/auth-enhanced.ts`

- Changed SMS sending from `await` to fire-and-forget pattern
- Response is returned immediately without waiting for SMS
- SMS errors are logged but don't block the response

```typescript
// Don't await - send SMS in background to avoid blocking response
sendSmsViaSns(normalizedPhone, message).catch((smsError: any) => {
  console.warn('[AUTH] Production Mode: SMS send failed (non-blocking):', smsError?.message || smsError);
});
```

### 4. Added Performance Logging
**File:** `backend/lambda/src/endpoints/auth-enhanced.ts`

- Added timing logs for each operation
- Tracks total handler duration
- Helps identify bottlenecks

```typescript
const handlerStartTime = Date.now();
// ... operations ...
const handlerDuration = Date.now() - handlerStartTime;
console.log(`[AUTH] Send OTP handler completed in ${handlerDuration}ms`);
```

## Time Budget

With the optimizations, the request should complete in:
- **OTP Generation**: < 1ms
- **Database Query (settings)**: < 2s (with timeout)
- **OTP Storage**: < 3s (with timeout)
- **Response Return**: Immediate (SMS is non-blocking)
- **Total**: < 5-6 seconds (well under 30s API Gateway limit)

## Testing

### Manual Test
```bash
# Test the endpoint
curl -X POST https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"919876543210","role":"vendor"}' \
  --max-time 35
```

### Using Test Script
```bash
# Run investigation script
./scripts/investigate-send-otp-timeout.sh 919876543210

# Run simple test
./scripts/test-send-otp-endpoint.sh 919876543210
```

### Check CloudWatch Logs
```bash
# View recent logs
aws logs filter-log-events \
  --log-group-name "/aws/lambda/warmpawz-api-prod" \
  --filter-pattern "send-otp" \
  --start-time $(date -u -d '5 minutes ago' +%s)000 \
  --max-items 20
```

## Monitoring

### Key Metrics to Watch
1. **Handler Duration**: Should be < 10 seconds
2. **Database Query Time**: Should be < 2 seconds
3. **SMS Send Time**: Should be < 5 seconds (if awaited)
4. **Timeout Errors**: Should be 0

### CloudWatch Alarms
Consider setting up alarms for:
- Lambda duration > 20 seconds
- Error rate > 5%
- Timeout errors > 0

## Additional Improvements

### Future Optimizations
1. **Cache SMS Settings**: Cache `platform_settings` in memory to avoid database query
2. **Use SQS for SMS**: Queue SMS messages to SQS for async processing
3. **Connection Pooling**: Ensure database connection pool is optimized
4. **Cold Start Optimization**: Use provisioned concurrency for critical endpoints

## Related Files

- `backend/lambda/src/endpoints/auth-enhanced.ts` - Main handler
- `scripts/investigate-send-otp-timeout.sh` - Investigation script
- `scripts/test-send-otp-endpoint.sh` - Test script
- `docs/RAZORPAY_30S_TIMEOUT_LIMIT.md` - Similar timeout issue documentation

## Status

✅ **FIXED** - Timeouts added, SMS made non-blocking, performance logging added
