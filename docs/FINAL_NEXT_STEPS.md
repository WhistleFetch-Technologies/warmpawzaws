# Final Next Steps: Complete Async Razorpay Setup

## ✅ Current Status

**Working:**
- ✅ `POST /razorpay/create-order` - Returns in 0.12s with `202 Accepted`
- ✅ `GET /razorpay/order-status/:paymentId` - Status polling endpoint
- ✅ `POST /razorpay/process-async` - Background processor (HTTP endpoint)
- ✅ API Gateway routes fixed
- ✅ Async pattern fully implemented

**Remaining:**
- ⏳ SQS queue URL configuration
- ⏳ SQS → Lambda event source mapping
- ⏳ SQS event handler in Lambda (or use HTTP endpoint)

---

## 🎯 Priority Actions

### 1. Configure SQS Queue URL (5 minutes)

```bash
./scripts/configure-sqs-queue-url.sh ap-south-1 dev
```

**What it does:**
- Gets SQS queue URL
- Adds `SQS_PAYMENT_QUEUE_URL` to Lambda environment variables

**Manual alternative:**
```bash
aws lambda update-function-configuration \
  --function-name warmpawz-dev-api-handler \
  --environment "Variables={SQS_PAYMENT_QUEUE_URL=https://ap-south-1.queue.amazonaws.com/057442119249/warmpawz-dev-payment-processing}" \
  --region ap-south-1
```

---

### 2. Choose SQS Processing Approach

You have **two options**:

#### Option A: HTTP Endpoint (Simpler - Recommended for now)

The `/razorpay/process-async` endpoint already exists and works. You can:

1. **Use API Gateway to trigger Lambda from SQS** (if supported)
2. **Use EventBridge** to call the HTTP endpoint when SQS receives messages
3. **Manually trigger** via HTTP for testing

**Pros:**
- ✅ Already working
- ✅ No code changes needed
- ✅ Easy to test

**Cons:**
- ⚠️ Requires API Gateway/EventBridge setup
- ⚠️ Slightly more latency

#### Option B: Direct SQS Handler (More efficient)

Add SQS event handling to the Lambda handler:

**File:** `backend/lambda/src/handler/index.ts`

```typescript
import { SQSEvent } from 'aws-lambda';

// Add at the top of handler function
export const handler = async (
  event: APIGatewayProxyEventV2 | SQSEvent,
  context: Context
): Promise<APIGatewayProxyResultV2 | void> => {
  
  // Check if it's an SQS event
  if ('Records' in event && Array.isArray(event.Records)) {
    // Handle SQS event
    return handleSQSEvent(event as SQSEvent, context);
  }
  
  // Otherwise, handle API Gateway event (existing code)
  // ... rest of existing handler code
};

async function handleSQSEvent(event: SQSEvent, context: Context): Promise<void> {
  for (const record of event.Records) {
    try {
      const messageBody = JSON.parse(record.body);
      
      if (messageBody.type === 'create_razorpay_order') {
        // Create API Gateway event structure for the async processor
        const apiEvent = {
          version: '2.0',
          routeKey: 'POST /razorpay/process-async',
          rawPath: '/razorpay/process-async',
          requestContext: {
            http: { method: 'POST', path: '/razorpay/process-async' },
            requestId: context.requestId || `sqs-${Date.now()}`,
            apiId: 'sqs-internal',
          },
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(messageBody),
        } as APIGatewayProxyEventV2;
        
        // Call the existing handler (which will route to /razorpay/process-async)
        await handler(apiEvent, context);
      }
    } catch (error) {
      console.error('SQS message processing error:', error);
      throw error; // Will trigger retry or DLQ
    }
  }
}
```

**Pros:**
- ✅ Direct SQS → Lambda processing
- ✅ Lower latency
- ✅ More efficient

**Cons:**
- ⚠️ Requires code changes
- ⚠️ Need to test SQS event handling

---

### 3. Set Up SQS → Lambda Trigger

**If using Option A (HTTP endpoint):**
- Skip this step (use EventBridge or manual HTTP calls)

**If using Option B (Direct SQS handler):**
```bash
./scripts/setup-sqs-lambda-trigger.sh ap-south-1 dev
```

**What it does:**
- Creates event source mapping
- Grants SQS permission to invoke Lambda
- Sets batch size and concurrency

---

### 4. Test End-to-End

```bash
./scripts/test-async-razorpay.sh
```

**What it does:**
1. Creates order (should return `202` in < 1s)
2. Checks status immediately (should be `processing`)
3. Polls status endpoint every 2s
4. Verifies status changes to `ready` with Razorpay order details

---

## 📋 Recommended Approach

### Phase 1: Immediate (Today)
1. ✅ Configure SQS queue URL
2. ✅ Test with manual HTTP call to `/razorpay/process-async`
3. ✅ Verify end-to-end flow works

### Phase 2: Automation (This Week)
1. Add SQS event handler to Lambda (Option B)
2. Set up SQS → Lambda trigger
3. Test automatic processing
4. Monitor CloudWatch logs

### Phase 3: Production (Next Week)
1. Set up monitoring/alerts
2. Configure Dead Letter Queue (DLQ)
3. Frontend integration
4. Load testing

---

## 🧪 Manual Testing (Without SQS)

Even without SQS configured, you can test the full flow:

```bash
# 1. Create order
RESPONSE=$(curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"516768d9-e975-466c-98c8-fa2414f7d136","amount":2049}' -s)

PAYMENT_ID=$(echo "$RESPONSE" | jq -r '.paymentId')

# 2. Manually trigger processor (since SQS might not be configured)
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/process-async" \
  -H "Content-Type: application/json" \
  -d "{
    \"payment_id\": \"$PAYMENT_ID\",
    \"booking_id\": \"516768d9-e975-466c-98c8-fa2414f7d136\",
    \"amount\": 2049,
    \"currency\": \"INR\",
    \"order_data\": {
      \"amount\": 204900,
      \"currency\": \"INR\",
      \"receipt\": \"bk_test\",
      \"notes\": {\"bookingId\": \"516768d9-e975-466c-98c8-fa2414f7d136\"}
    }
  }"

# 3. Check status
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/order-status/$PAYMENT_ID"
```

---

## 📊 Verification Checklist

- [ ] SQS_PAYMENT_QUEUE_URL environment variable set
- [ ] Order creation returns `202` in < 1s
- [ ] Status endpoint shows `processing` initially
- [ ] Status endpoint shows `ready` after processing
- [ ] Razorpay order created (check Razorpay dashboard)
- [ ] Payment record in database with `razorpay_order_id`
- [ ] SQS messages being processed (if using SQS)
- [ ] Error handling works (invalid booking, etc.)

---

## 🚨 Troubleshooting

### Issue: Status always "processing"
- **Check:** Is SQS configured? Messages being processed?
- **Check:** CloudWatch logs for errors
- **Check:** Manual HTTP call to `/razorpay/process-async` works?

### Issue: SQS messages not processed
- **Check:** Event source mapping exists
- **Check:** Lambda has SQS permissions
- **Check:** Queue visibility timeout > Lambda timeout

### Issue: Payment record not created
- **Check:** Database connection
- **Check:** Booking exists
- **Check:** Error logs in CloudWatch

---

## 📚 Documentation

- `docs/NEXT_STEPS_COMPLETE.md` - Detailed guide
- `docs/QUICK_START_ASYNC_RAZORPAY.md` - Quick reference
- `docs/ASYNC_RAZORPAY_SUCCESS.md` - Success summary
- `scripts/` - Automation scripts

---

**Status**: Ready for SQS integration
**Next Action**: Run `./scripts/configure-sqs-queue-url.sh`
**Estimated Time**: 10-15 minutes for full setup
