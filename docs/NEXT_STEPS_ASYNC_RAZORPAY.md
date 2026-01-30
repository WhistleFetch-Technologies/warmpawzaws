# Next Steps: Async Razorpay Implementation

## ✅ Current Status

### What's Working
1. **Direct Lambda Invocation**: ✅ Works perfectly (< 1 second)
   - Returns `202 Accepted` with `status: 'processing'`
   - Async pattern is correctly implemented

2. **Code Implementation**: ✅ Complete
   - Async endpoint returns immediately
   - Status endpoint created
   - SQS queue processor ready
   - Background job handler implemented

### What's Not Working
1. **API Gateway Integration**: ⚠️ Timing out at 30 seconds
   - Integration timeout: 30000ms (30s hard limit for HTTP APIs)
   - Direct Lambda works, so issue is in API Gateway layer

## Root Cause

**API Gateway HTTP API has a 30-second hard timeout limit** that cannot be increased. Even though:
- Lambda code returns in < 1 second (confirmed via direct invocation)
- Async pattern is correctly implemented
- No blocking operations in the handler

The API Gateway integration is still timing out, suggesting:
- API Gateway might not be properly forwarding requests to Lambda
- There might be a delay in the integration layer
- Cold start + integration overhead might be exceeding 30s

## Immediate Actions

### 1. Verify API Gateway Route Configuration
```bash
# Check which integration the route uses
aws apigatewayv2 get-routes --api-id z0b3obweb6 --region ap-south-1
```

### 2. Test with Warm Lambda
```bash
# Invoke a simple endpoint first to warm Lambda
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/health"

# Then immediately test Razorpay endpoint
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"516768d9-e975-466c-98c8-fa2414f7d136","amount":2049}'
```

### 3. Check CloudWatch Metrics
- Look for Lambda invocation delays
- Check API Gateway integration latency
- Monitor cold start times

## Solutions

### Solution 1: Use Direct Lambda Invocation (Temporary)
Since direct Lambda works, you could:
- Use API Gateway → Lambda direct integration (bypass some layers)
- Or use Application Load Balancer → Lambda

### Solution 2: Switch to REST API
- REST APIs can have timeout increased via Service Quotas
- Requires infrastructure changes
- More complex but allows > 30s timeout

### Solution 3: Optimize Cold Starts
- Pre-warm Lambda functions
- Reduce VPC cold start time
- Optimize Lambda package size

### Solution 4: Use API Gateway Direct Response (Recommended)
- Return immediate response from API Gateway
- Trigger Lambda asynchronously
- Requires API Gateway configuration changes

## Implementation Status

### ✅ Completed
- [x] Async pattern code implementation
- [x] Status endpoint (`GET /razorpay/order-status/:paymentId`)
- [x] Background processor (`ProcessRazorpayOrderAsyncHandler`)
- [x] SQS queue integration
- [x] Direct Lambda invocation test (works!)

### ⏳ Pending
- [ ] API Gateway integration optimization
- [ ] SQS → Lambda trigger setup (if using SQS)
- [ ] Frontend integration (polling status endpoint)
- [ ] Error handling and retry logic

## Testing the Async Pattern

### Step 1: Process Order Manually (Since SQS might not be configured)
```bash
# Get the paymentId from the create-order response
PAYMENT_ID="pay_..."

# Manually trigger the async processor
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/process-async" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "'$PAYMENT_ID'",
    "booking_id": "516768d9-e975-466c-98c8-fa2414f7d136",
    "amount": 2049,
    "currency": "INR",
    "order_data": {...}
  }'
```

### Step 2: Check Status
```bash
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/order-status/$PAYMENT_ID"
```

## Recommended Next Steps

1. **Immediate**: Test with warm Lambda (invoke health endpoint first)
2. **Short-term**: Set up SQS → Lambda trigger for automatic processing
3. **Medium-term**: Consider switching to REST API if timeout persists
4. **Long-term**: Optimize cold starts and VPC configuration

---

**Date**: 2026-01-23
**Status**: Code complete, API Gateway integration issue
**Priority**: High - blocking payment flow
