# Next Steps: Complete Async Razorpay Implementation

## ✅ Current Status

**Working:**
- ✅ `POST /razorpay/create-order` - Returns in 0.12s with `202 Accepted`
- ✅ `GET /razorpay/order-status/:paymentId` - Status endpoint available
- ✅ `POST /razorpay/process-async` - Background processor ready
- ✅ API Gateway routes fixed to use correct Lambda

**Pending:**
- ⏳ SQS queue integration (automatic processing)
- ⏳ Environment variable configuration
- ⏳ End-to-end testing
- ⏳ Frontend integration

---

## Step 1: Configure SQS Queue URL

### Option A: Update Lambda Environment Variable

```bash
# Get the SQS queue URL
QUEUE_URL=$(aws sqs get-queue-url \
  --queue-name warmpawz-dev-payment-processing \
  --region ap-south-1 \
  --query 'QueueUrl' \
  --output text)

# Update Lambda environment variable
aws lambda update-function-configuration \
  --function-name warmpawz-dev-api-handler \
  --environment "Variables={SQS_PAYMENT_QUEUE_URL=$QUEUE_URL}" \
  --region ap-south-1
```

### Option B: Update serverless.yml

Add to `backend/lambda/serverless.yml`:

```yaml
provider:
  environment:
    # ... existing vars ...
    SQS_PAYMENT_QUEUE_URL: ${ssm:/warmpawz/${self:provider.stage}/sqs/paymentQueueUrl, 'https://ap-south-1.queue.amazonaws.com/057442119249/warmpawz-dev-payment-processing'}
```

Or store in SSM Parameter Store:

```bash
aws ssm put-parameter \
  --name /warmpawz/dev/sqs/paymentQueueUrl \
  --value "https://ap-south-1.queue.amazonaws.com/057442119249/warmpawz-dev-payment-processing" \
  --type String \
  --region ap-south-1 \
  --overwrite
```

---

## Step 2: Set Up SQS → Lambda Trigger

### Option A: Using AWS Console

1. Go to Lambda → `warmpawz-dev-api-handler`
2. Add trigger → SQS
3. Select queue: `warmpawz-dev-payment-processing`
4. Batch size: 10
5. Maximum concurrency: 5
6. Save

### Option B: Using AWS CLI

```bash
# Get queue ARN
QUEUE_ARN=$(aws sqs get-queue-attributes \
  --queue-url "https://ap-south-1.queue.amazonaws.com/057442119249/warmpawz-dev-payment-processing" \
  --attribute-names QueueArn \
  --region ap-south-1 \
  --query 'Attributes.QueueArn' \
  --output text)

# Create event source mapping
aws lambda create-event-source-mapping \
  --function-name warmpawz-dev-api-handler \
  --event-source-arn "$QUEUE_ARN" \
  --batch-size 10 \
  --maximum-concurrency 5 \
  --region ap-south-1
```

### Option C: Using Serverless Framework

Add to `backend/lambda/serverless.yml`:

```yaml
functions:
  api:
    handler: dist/handler.handler
    events:
      - httpApi:
          path: /{proxy+}
          method: ANY
      - httpApi:
          path: /
          method: ANY
      # Add SQS trigger
      - sqs:
          arn: arn:aws:sqs:ap-south-1:057442119249:warmpawz-dev-payment-processing
          batchSize: 10
          maximumConcurrency: 5
```

**Note:** The SQS handler needs to be added to the Lambda handler to process SQS events.

---

## Step 3: Add SQS Event Handler

The Lambda needs to handle SQS events. Update `backend/lambda/src/handler/index.ts`:

```typescript
// Add SQS event handler
export const sqsHandler = async (
  event: SQSEvent,
  context: Context
): Promise<void> => {
  for (const record of event.Records) {
    try {
      const messageBody = JSON.parse(record.body);
      
      if (messageBody.type === 'create_razorpay_order') {
        // Create API Gateway event for the async processor
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
        };
        
        // Call the async processor
        await handler(apiEvent as any, context);
      }
    } catch (error) {
      console.error('SQS message processing error:', error);
      // Message will be retried or sent to DLQ
      throw error;
    }
  }
};
```

Or create a separate handler file: `backend/lambda/src/handler/sqs-handler.ts`

---

## Step 4: Test End-to-End Flow

### Test Script

```bash
#!/bin/bash
# test-async-razorpay.sh

echo "1. Creating Razorpay order..."
RESPONSE=$(curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -H "Origin: https://d2aoyjj8ine0wk.cloudfront.net" \
  -d '{
    "bookingId": "516768d9-e975-466c-98c8-fa2414f7d136",
    "amount": 2049,
    "customerId": "39c84571-b26d-475a-bb38-94975cb8262d",
    "currency": "INR"
  }' -s)

echo "$RESPONSE" | jq '.'

PAYMENT_ID=$(echo "$RESPONSE" | jq -r '.paymentId')
echo ""
echo "Payment ID: $PAYMENT_ID"
echo ""

echo "2. Waiting 5 seconds for processing..."
sleep 5

echo "3. Checking status..."
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/order-status/$PAYMENT_ID" \
  -s | jq '.'

echo ""
echo "4. If status is still 'processing', wait and check again..."
```

### Manual Test Steps

1. **Create Order:**
   ```bash
   curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/create-order" \
     -H "Content-Type: application/json" \
     -d '{"bookingId":"516768d9-e975-466c-98c8-fa2414f7d136","amount":2049}'
   ```

2. **Check Status (immediately):**
   ```bash
   curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/order-status/{paymentId}"
   ```
   Expected: `{"status": "processing"}`

3. **Wait 5-10 seconds, check again:**
   ```bash
   curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/order-status/{paymentId}"
   ```
   Expected: `{"status": "ready", "orderId": "order_...", "keyId": "rzp_..."}`

4. **Verify in Database:**
   ```sql
   SELECT id, razorpay_order_id, payment_status, metadata 
   FROM payments 
   WHERE id = '{paymentId}';
   ```

---

## Step 5: Frontend Integration

### React/Next.js Example

```typescript
// hooks/useRazorpayOrder.ts
import { useState, useCallback } from 'react';

interface CreateOrderResponse {
  success: boolean;
  status: 'processing';
  paymentId: string;
  message: string;
}

interface OrderStatusResponse {
  status: 'processing' | 'ready' | 'failed';
  paymentId: string;
  orderId?: string;
  keyId?: string;
  amount?: number;
  currency?: string;
  errorMessage?: string;
}

export function useRazorpayOrder() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createOrder = useCallback(async (
    bookingId: string,
    amount: number,
    customerId?: string
  ): Promise<OrderStatusResponse> => {
    setIsProcessing(true);
    setError(null);

    try {
      // 1. Create order (returns immediately)
      const createResponse = await fetch('/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          amount,
          customerId,
          currency: 'INR',
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create order');
      }

      const createData: CreateOrderResponse = await createResponse.json();
      const { paymentId } = createData;

      // 2. Poll status endpoint
      const maxAttempts = 20; // 20 attempts = ~40 seconds
      const pollInterval = 2000; // 2 seconds

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        const statusResponse = await fetch(`/razorpay/order-status/${paymentId}`);
        const statusData: OrderStatusResponse = await statusResponse.json();

        if (statusData.status === 'ready') {
          setIsProcessing(false);
          return statusData; // Order ready!
        } else if (statusData.status === 'failed') {
          setIsProcessing(false);
          setError(statusData.errorMessage || 'Order creation failed');
          throw new Error(statusData.errorMessage || 'Order creation failed');
        }
        // Continue polling if status is 'processing'
      }

      // Timeout
      setIsProcessing(false);
      setError('Order creation timed out');
      throw new Error('Order creation timed out');
    } catch (err) {
      setIsProcessing(false);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  return { createOrder, isProcessing, error };
}

// Usage in component
function PaymentButton({ bookingId, amount, customerId }) {
  const { createOrder, isProcessing, error } = useRazorpayOrder();

  const handlePayment = async () => {
    try {
      const orderStatus = await createOrder(bookingId, amount, customerId);
      
      // Initialize Razorpay with order details
      const options = {
        key: orderStatus.keyId!,
        amount: orderStatus.amount!,
        currency: orderStatus.currency || 'INR',
        order_id: orderStatus.orderId!,
        name: 'Warmpawz',
        description: 'Pet Service Payment',
        handler: function (response: any) {
          // Handle payment success
          console.log('Payment successful:', response);
        },
        prefill: {
          email: customerEmail,
          contact: customerPhone,
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (err) {
      // Show error to user
      alert(error || 'Failed to initialize payment');
    }
  };

  return (
    <button onClick={handlePayment} disabled={isProcessing}>
      {isProcessing ? 'Processing...' : 'Pay Now'}
    </button>
  );
}
```

---

## Step 6: Monitoring & Error Handling

### CloudWatch Alarms

```bash
# Create alarm for failed payments
aws cloudwatch put-metric-alarm \
  --alarm-name razorpay-order-failures \
  --alarm-description "Alert when Razorpay order creation fails" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=warmpawz-dev-api-handler \
  --evaluation-periods 1 \
  --region ap-south-1
```

### Dead Letter Queue (DLQ)

Set up DLQ for failed SQS messages:

```bash
# Create DLQ
aws sqs create-queue \
  --queue-name warmpawz-dev-payment-processing-dlq \
  --region ap-south-1

# Configure source queue with DLQ
aws sqs set-queue-attributes \
  --queue-url "https://ap-south-1.queue.amazonaws.com/057442119249/warmpawz-dev-payment-processing" \
  --attributes '{
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"arn:aws:sqs:ap-south-1:057442119249:warmpawz-dev-payment-processing-dlq\",\"maxReceiveCount\":3}"
  }' \
  --region ap-south-1
```

---

## Step 7: Verification Checklist

- [ ] SQS_PAYMENT_QUEUE_URL environment variable configured
- [ ] SQS → Lambda event source mapping created
- [ ] SQS event handler added to Lambda
- [ ] Test order creation returns `202 Accepted`
- [ ] Test status endpoint shows `processing` initially
- [ ] Test status endpoint shows `ready` after processing
- [ ] Verify Razorpay order created in Razorpay dashboard
- [ ] Verify payment record in database
- [ ] Frontend integration tested
- [ ] Error handling tested (invalid booking, etc.)
- [ ] Monitoring/alerts configured

---

## Quick Start Commands

```bash
# 1. Configure environment variable
./scripts/configure-sqs-queue-url.sh

# 2. Set up SQS trigger
./scripts/setup-sqs-lambda-trigger.sh

# 3. Test end-to-end
./scripts/test-async-razorpay.sh

# 4. Check logs
aws logs tail /aws/lambda/warmpawz-dev-api-handler --since 5m --region ap-south-1
```

---

## Troubleshooting

### Issue: Status always shows "processing"
- **Check:** SQS messages are being processed
- **Check:** Async processor is being called
- **Check:** CloudWatch logs for errors

### Issue: SQS messages not processed
- **Check:** Event source mapping exists
- **Check:** Lambda has SQS permissions
- **Check:** Queue visibility timeout > Lambda timeout

### Issue: Payment record not created
- **Check:** Database connection
- **Check:** Booking exists
- **Check:** Error logs in CloudWatch

---

**Priority Order:**
1. ⚡ **High**: Configure SQS_PAYMENT_QUEUE_URL
2. ⚡ **High**: Set up SQS → Lambda trigger
3. ⚡ **High**: Test end-to-end flow
4. 📋 **Medium**: Frontend integration
5. 📋 **Medium**: Monitoring & alerts

---

**Date**: 2026-01-23
**Status**: Ready for SQS integration and testing
