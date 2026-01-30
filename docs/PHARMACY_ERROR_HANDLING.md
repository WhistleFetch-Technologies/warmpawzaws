# Pharmacy Order Flow - Error Handling & Edge Cases

## Implementation Date
2026-01-XX

## Error Scenarios Handled

### 1. ✅ No Pharmacies Found During Broadcast
**Location**: `broadcastToPharmacies()` function
**Handling**:
- Updates order status to `no_pharmacy_found`
- Sends notification to customer with helpful message
- Returns error result for upstream handling

### 2. ✅ All Pharmacies Reject Order
**Location**: `POST /pharmacy/orders/:orderId/reject` endpoint
**Handling**:
- Detects when all pharmacies have rejected
- Cancels order automatically
- Notifies customer with actionable message
- Provides reason: "All pharmacies rejected your order. Please try with a different prescription or location."

### 3. ✅ Broadcast Timeout (No Acceptance)
**Location**: `POST /pharmacy/orders/:orderId/expand-broadcast` endpoint
**Handling**:
- After 20km radius expansion, if no pharmacy accepts, order is cancelled
- Customer notified with appropriate message
- Frontend timeout handling (6 minutes) with detailed error messages

### 4. ✅ Payment Gateway Failures
**Location**: `POST /pharmacy/orders/:orderId/payment` endpoint
**Handling**:
- Retry logic with exponential backoff (3 attempts)
- Customer notification on payment gateway errors
- Returns `503 Service Unavailable` with `retryable: true` flag
- Error code: `PAYMENT_GATEWAY_ERROR`

### 5. ✅ Network Failures
**Location**: Multiple endpoints
**Handling**:
- Try-catch blocks around all external API calls (Razorpay, Shiprocket)
- Graceful degradation (order continues even if Shiprocket fails)
- Logging for debugging

### 6. ✅ OTP Verification Failures
**Location**: `POST /pharmacy/orders/:orderId/complete` endpoint
**Handling**:
- Tracks failed OTP attempts (if column exists)
- Locks delivery after 3 failed attempts
- Returns `429 Too Many Requests` with `OTP_LOCKED` code
- Provides attempts remaining in error message

### 7. ✅ Delivery Partner Unavailable
**Location**: `POST /pharmacy/orders/:orderId/update-status` (ready_for_pickup)
**Handling**:
- Detects when `autoAssignDeliveryPartner` returns null
- Updates order status to `waiting_for_delivery_partner`
- Notifies pharmacy to arrange own delivery
- Logs warning for monitoring

### 8. ✅ Tracking Record Not Found
**Location**: `POST /pharmacy/orders/:orderId/complete` endpoint
**Handling**:
- Returns `400 Bad Request` with `NO_TRACKING` code
- Provides helpful message: "Delivery tracking not initialized. Please contact support."

### 9. ✅ Broadcast Expiry
**Location**: Frontend polling + Backend status checks
**Handling**:
- Frontend timeout after 6 minutes
- Checks broadcast status to determine reason (all rejected vs no pharmacies)
- Shows appropriate error message to user

## Error Codes

| Code | Description | HTTP Status | Retryable |
|------|-------------|-------------|-----------|
| `NO_TRACKING` | Tracking record not found | 400 | No |
| `INVALID_OTP` | Invalid delivery OTP | 400 | Yes |
| `OTP_LOCKED` | Too many failed OTP attempts | 429 | No |
| `OTP_REQUIRED` | OTP required for delivery | 400 | No |
| `PAYMENT_GATEWAY_ERROR` | Payment gateway unavailable | 503 | Yes |
| `PAYMENT_ERROR` | General payment error | 500 | Yes |
| `no_pharmacies_found` | No pharmacies in radius | N/A | Yes (expand radius) |
| `broadcast_failed` | Broadcast system error | N/A | Yes |

## Notification Messages

### Customer Notifications
- **No Pharmacy Found**: "No pharmacies found within Xkm. Please try again later or expand your search area."
- **All Rejected**: "All pharmacies rejected your order. Please try with a different prescription or location."
- **Payment Failed**: "Payment gateway temporarily unavailable. Please try again in a few minutes."
- **OTP Locked**: "Too many failed OTP attempts. Please contact the delivery partner or support."

### Pharmacy Notifications
- **Delivery Partner Unavailable**: "Order ready but no delivery partner available. Please arrange your own delivery or wait for partner assignment."

## Best Practices Implemented

1. **Graceful Degradation**: Non-critical failures don't block order flow
2. **User-Friendly Messages**: Error messages are actionable and helpful
3. **Retry Logic**: Payment gateway calls have retry with exponential backoff
4. **Status Tracking**: Order status reflects error conditions
5. **Notification Integration**: Customers and vendors are notified of errors
6. **Logging**: All errors are logged for debugging and monitoring

## Monitoring Recommendations

1. Track `no_pharmacy_found` orders - may indicate coverage gaps
2. Monitor `all_rejected` orders - may indicate prescription issues
3. Alert on `PAYMENT_GATEWAY_ERROR` - indicates Razorpay issues
4. Track `OTP_LOCKED` occurrences - may indicate delivery issues
5. Monitor `delivery_partner_assignment_failed` - indicates logistics capacity issues
