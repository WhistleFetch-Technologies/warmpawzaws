# SMS Service Implementation

## Overview
SMS service integrated using AWS SNS for sending transactional SMS messages, particularly for OTP delivery in pharmacy orders.

## Implementation Date
2026-01-XX

## Features

### 1. OTP Delivery
- Sends delivery OTP via SMS when order is confirmed
- Sends delivery OTP via SMS when order is dispatched
- Includes order ID in message for reference

### 2. Phone Number Normalization
- Supports multiple Indian phone number formats:
  - `+91XXXXXXXXXX` (E.164 format)
  - `91XXXXXXXXXX` (without +)
  - `0XXXXXXXXXX` (with leading 0)
  - `XXXXXXXXXX` (10-digit)
- Automatically normalizes to E.164 format (`+91XXXXXXXXXX`)

### 3. SMS Templates
- `delivery_otp`: OTP for delivery verification
- `order_confirmed`: Order confirmation message
- `order_dispatched`: Order dispatched with ETA
- `order_delivered`: Order delivered confirmation
- `payment_successful`: Payment confirmation
- `pharmacy_accepted`: Pharmacy accepted order
- `pharmacy_rejected`: Pharmacy rejected order

## Configuration

### Environment Variables
- `SMS_ENABLED`: Enable/disable SMS (default: `true`)
- `SMS_SENDER_ID`: Sender ID for SMS (default: `WARMPAWZ`)
- `AWS_REGION`: AWS region (default: `ap-south-1`)

### AWS SNS Setup
1. Ensure AWS SNS is configured in the region
2. Set up SMS spending limits in AWS SNS console
3. Configure sender ID (requires approval in some regions)
4. Set up delivery status logging (optional)

## Usage

### Basic SMS
```typescript
import { smsService } from '../lib/services/sms-service';

const result = await smsService.sendSMS(
  '+919876543210',
  'Your message here',
  {
    messageType: 'Transactional',
    senderId: 'WARMPAWZ',
  }
);
```

### Send OTP
```typescript
const result = await smsService.sendOTP(
  '+919876543210',
  '1234',
  'order-id-123',
  'pharmacy'
);
```

### Order Notifications
```typescript
// Order confirmed
await smsService.sendOrderConfirmation('+919876543210', 'order-id-123');

// Order dispatched
await smsService.sendOrderDispatched('+919876543210', 'order-id-123', '30 minutes');

// Order delivered
await smsService.sendOrderDelivered('+919876543210', 'order-id-123');

// Payment successful
await smsService.sendPaymentSuccess('+919876543210', 'order-id-123', 500);
```

## Integration Points

### Pharmacy Orders
1. **Order Confirmation** (`POST /pharmacy/orders/:orderId/payment`)
   - Sends OTP when order is confirmed (COD or paid)

2. **Order Dispatch** (`POST /pharmacy/orders/:orderId/dispatch`)
   - Sends OTP when order is dispatched for delivery

## Error Handling

- SMS failures are logged but don't block order flow
- Returns `SMSResult` with status and error details
- Graceful degradation: if SMS fails, order continues

## Cost Considerations

- AWS SNS SMS pricing varies by region
- India: ~₹0.20-0.50 per SMS (transactional)
- Monitor usage via CloudWatch metrics
- Set up spending limits in AWS SNS console

## Testing

### Development Mode
- Set `SMS_ENABLED=false` to mock SMS sending
- SMS messages are logged to console instead

### Production Testing
- Use test phone numbers
- Verify SMS delivery in AWS SNS console
- Check CloudWatch logs for delivery status

## Future Enhancements

1. **Delivery Status Tracking**
   - Track SMS delivery status via SNS delivery receipts
   - Store delivery status in database

2. **SMS Analytics**
   - Track SMS success/failure rates
   - Monitor costs per order type

3. **Multi-language Support**
   - Support regional languages
   - Template-based messages

4. **SMS Queue**
   - Queue SMS for retry on failure
   - Batch SMS sending

## Monitoring

### CloudWatch Metrics
- `SMSDeliverySuccess`
- `SMSDeliveryFailure`
- `SMSCost`

### Logs
- All SMS attempts are logged
- Success: `✅ SMS sent to {phone}: {messageId}`
- Failure: `❌ Failed to send SMS to {phone}: {error}`
