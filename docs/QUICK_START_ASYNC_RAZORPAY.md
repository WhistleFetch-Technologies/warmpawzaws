# Quick Start: Complete Async Razorpay Setup

## 🚀 Quick Setup (5 minutes)

### Step 1: Configure SQS Queue URL
```bash
./scripts/configure-sqs-queue-url.sh ap-south-1 dev
```

### Step 2: Set Up SQS → Lambda Trigger
```bash
./scripts/setup-sqs-lambda-trigger.sh ap-south-1 dev
```

### Step 3: Test End-to-End
```bash
./scripts/test-async-razorpay.sh
```

---

## ✅ What's Already Working

- ✅ `POST /razorpay/create-order` - Returns in 0.12s
- ✅ `GET /razorpay/order-status/:paymentId` - Status polling
- ✅ `POST /razorpay/process-async` - Background processor
- ✅ API Gateway routes fixed

---

## 📋 Manual Steps (if scripts don't work)

### 1. Set Environment Variable
```bash
aws lambda update-function-configuration \
  --function-name warmpawz-dev-api-handler \
  --environment "Variables={SQS_PAYMENT_QUEUE_URL=https://ap-south-1.queue.amazonaws.com/057442119249/warmpawz-dev-payment-processing}" \
  --region ap-south-1
```

### 2. Create Event Source Mapping
```bash
QUEUE_ARN=$(aws sqs get-queue-attributes \
  --queue-url "https://ap-south-1.queue.amazonaws.com/057442119249/warmpawz-dev-payment-processing" \
  --attribute-names QueueArn \
  --region ap-south-1 \
  --query 'Attributes.QueueArn' \
  --output text)

aws lambda create-event-source-mapping \
  --function-name warmpawz-dev-api-handler \
  --event-source-arn "$QUEUE_ARN" \
  --batch-size 10 \
  --region ap-south-1
```

### 3. Test
```bash
# Create order
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"516768d9-e975-466c-98c8-fa2414f7d136","amount":2049}'

# Check status (replace {paymentId})
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/order-status/{paymentId}"
```

---

## 🔍 Verify Setup

```bash
# Check environment variable
aws lambda get-function-configuration \
  --function-name warmpawz-dev-api-handler \
  --query 'Environment.Variables.SQS_PAYMENT_QUEUE_URL' \
  --region ap-south-1

# Check event source mapping
aws lambda list-event-source-mappings \
  --function-name warmpawz-dev-api-handler \
  --region ap-south-1
```

---

## 📚 Full Documentation

- `docs/NEXT_STEPS_COMPLETE.md` - Detailed next steps
- `docs/ASYNC_RAZORPAY_SUCCESS.md` - Success summary
- `docs/ASYNC_RAZORPAY_IMPLEMENTATION.md` - Implementation details

---

**Status**: Ready for SQS integration
**Priority**: High - Complete payment flow
