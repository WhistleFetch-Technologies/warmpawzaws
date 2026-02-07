# Async Razorpay Order Creation - Implementation Summary

## Status: ✅ IMPLEMENTED

The Razorpay order creation endpoint has been converted to an asynchronous pattern to avoid API Gateway's 30-second timeout limit.

## Architecture

### Flow

1. **Client Request** → `POST /razorpay/create-order`
   - Validates request format (UUID, amount > 0)
   - Generates payment ID
   - Queues job to SQS (fire-and-forget)
   - Returns immediately with `status: 'processing'` and `paymentId`

2. **Background Processing** (SQS → Lambda)
   - Fetches booking details
   - Fetches vendor details
   - Loads Razorpay config
   - Creates Razorpay order
   - Updates payment record with Razorpay order ID
   - Sets status to `pending` (ready for payment)

3. **Status Check** → `GET /razorpay/order-status/:paymentId`
   - Returns current status: `processing`, `ready`, or `failed`
   - If `ready`, includes `orderId` and `keyId` for frontend

## Endpoints

### POST /razorpay/create-order
**Request:**
```json
{
  "bookingId": "uuid",
  "amount": 2049,
  "currency": "INR",
  "customerId": "uuid" // optional
}
```

**Response (Immediate):**
```json
{
  "status": "processing",
  "paymentId": "pay_...",
  "message": "Payment order is being processed...",
  "estimatedTime": "5-10 seconds"
}
```

### GET /razorpay/order-status/:paymentId
**Response (Processing):**
```json
{
  "status": "processing",
  "paymentId": "...",
  "message": "Payment order is being processed..."
}
```

**Response (Ready):**
```json
{
  "status": "ready",
  "paymentId": "...",
  "orderId": "order_...",
  "amount": 2049,
  "currency": "INR",
  "keyId": "rzp_...",
  "message": "Razorpay order created successfully"
}
```

**Response (Failed):**
```json
{
  "status": "failed",
  "paymentId": "...",
  "error": "Error code",
  "errorMessage": "Error details"
}
```

## Implementation Details

### Files Modified
- `backend/lambda/src/endpoints/razorpay.ts`
  - `CreateRazorpayOrderHandler`: Returns immediately, queues job
  - `ProcessRazorpayOrderAsyncHandler`: Processes order creation in background
  - `GetRazorpayOrderStatusHandler`: Checks order status

### Database Schema
- `payments` table:
  - `payment_status`: `processing` → `pending` → `completed`/`failed`
  - `metadata`: JSON with processing details
  - `razorpay_order_id`: Updated by async processor

### SQS Queue
- Queue: `payment-queue`
- Message type: `create_razorpay_order`
- Payload includes: `payment_id`, `booking_id`, `amount`, `currency`, `order_data`

## Next Steps

1. **Set up SQS → Lambda trigger** (if not already configured)
   - Create Lambda function for payment queue processor
   - Or use existing handler with SQS event source

2. **Frontend Integration**
   - Call `/razorpay/create-order`
   - Poll `/razorpay/order-status/:paymentId` every 2-3 seconds
   - When status is `ready`, proceed with Razorpay payment UI

3. **Error Handling**
   - Handle `failed` status
   - Retry logic for transient failures
   - User notifications

## Testing

```bash
# 1. Create order (should return immediately)
curl -X POST "https://.../razorpay/create-order" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"...","amount":2049}'

# 2. Check status (poll every 2-3 seconds)
curl "https://.../razorpay/order-status/{paymentId}"
```

---

**Date**: 2026-01-23
**Status**: Implemented, needs SQS processor setup
