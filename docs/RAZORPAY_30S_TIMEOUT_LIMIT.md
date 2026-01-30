# Razorpay 503 - API Gateway 30-Second Timeout Limit

## Problem

`POST /razorpay/create-order` consistently times out at **exactly 30 seconds** with `503 Service Unavailable`.

## Root Cause

**API Gateway HTTP API has a hard 30-second integration timeout limit** that cannot be increased. This is different from Lambda's timeout (which we set to 60s).

- **API Gateway HTTP API**: Maximum 30 seconds (hard limit, cannot be increased)
- **Lambda Timeout**: 60 seconds (but irrelevant if API Gateway times out first)

When the total request time exceeds 30 seconds, API Gateway returns `503 Service Unavailable` with `{"message":"Service Unavailable"}`.

## Current Time Budget

Even with optimizations, the request is still taking >30 seconds:

1. **Config Loading**: 0-8s (cached = instant, cold start = 8s)
2. **Booking Query**: 2s max (with timeout)
3. **Vendor Query**: 2s max (with timeout)
4. **Razorpay API Call**: 10s max (with timeout)
5. **Network/Processing Overhead**: ~2-5s
6. **Total**: ~16-27s (should work, but still timing out)

## Optimizations Applied

1. ✅ Eliminated slow `getVendorTierCommission` query (uses vendor.commission_rate directly)
2. ✅ Added aggressive timeouts to all database queries (2s each)
3. ✅ Reduced Razorpay API timeout to 10s
4. ✅ Optimized config loading (cache-first approach)
5. ✅ Added error handling for timeouts

## Solutions

### Option 1: Switch to REST API (Recommended for Long Operations)

REST APIs can have integration timeouts increased beyond 30 seconds (up to 29 seconds by default, but can be increased via Service Quotas).

**Pros:**
- Can increase timeout to 60+ seconds
- More control over integration settings
- Better for long-running operations

**Cons:**
- Requires infrastructure changes
- May need to update API Gateway configuration
- More complex setup

**Steps:**
1. Request timeout increase in Service Quotas console
2. Update API Gateway integration timeout
3. Deploy changes

### Option 2: Asynchronous Pattern (Recommended for User Experience)

Return immediately with a "processing" status, then process the Razorpay order creation in the background.

**Flow:**
1. Client calls `/razorpay/create-order`
2. API immediately returns `202 Accepted` with `{ status: "processing", orderId: "..." }`
3. Lambda processes order creation in background (via SQS or direct async call)
4. Client polls `/razorpay/order-status/{orderId}` or receives webhook notification

**Pros:**
- Fast response (< 1 second)
- Better user experience
- No timeout issues
- Can handle longer operations

**Cons:**
- Requires frontend changes (polling or webhooks)
- More complex architecture
- Need to handle status tracking

### Option 3: Further Optimizations (May Not Be Enough)

1. **Pre-warm Lambda**: Keep Lambda warm to avoid cold starts
2. **Database Indexing**: Ensure all queries use indexes
3. **Connection Pooling**: Optimize database connection pool
4. **Razorpay API Optimization**: Check if Razorpay API is slow (may need to contact Razorpay support)

**Pros:**
- No architecture changes
- Keeps synchronous flow

**Cons:**
- May still hit 30s limit
- Limited by external API (Razorpay) response time

## Recommended Approach

**Short-term**: Implement **Option 2 (Asynchronous Pattern)** for immediate fix.

**Long-term**: Consider **Option 1 (REST API)** if you need synchronous operations that take >30 seconds.

## Implementation Plan (Asynchronous Pattern)

1. **Modify `/razorpay/create-order` endpoint**:
   - Validate request
   - Create order record in database with status "pending"
   - Queue background job (SQS or direct async Lambda invocation)
   - Return immediately with order ID

2. **Create background processor**:
   - Process Razorpay order creation
   - Update order record with Razorpay order ID
   - Handle errors and retries

3. **Add status endpoint**:
   - `GET /razorpay/order-status/{orderId}`
   - Returns current status and Razorpay order details when ready

4. **Update frontend**:
   - Poll status endpoint or use webhooks
   - Show loading state while processing

## Current Status

- ✅ Code optimizations deployed
- ⚠️ Still hitting 30s API Gateway timeout
- 🔄 Need to implement async pattern or switch to REST API

---

**Date**: 2026-01-23
**Status**: Blocked by API Gateway HTTP API 30s hard limit
**Next Step**: Implement async pattern or switch to REST API
