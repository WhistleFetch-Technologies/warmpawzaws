# 📡 Webhook Setup Guide

**Complete guide for setting up webhooks for Razorpay and Shiprocket integrations**

---

## 🔐 Step 3: Setup Webhooks

### **Why Webhooks?**

Webhooks allow payment gateways and logistics providers to notify your server about important events in real-time:
- Payment success/failure
- Refund processed
- Shipment status updates
- Delivery confirmation
- Non-delivery reports (NDR)

---

## 💳 RAZORPAY WEBHOOK SETUP

### **1. Login to Razorpay Dashboard**

Visit: https://dashboard.razorpay.com/

### **2. Navigate to Webhooks**

- Go to **Settings** → **Webhooks**
- Click **"+ Create New Webhook"**

### **3. Configure Webhook URL**

**Webhook URL:**
```
https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/payments/razorpay/webhook
```

### **4. Select Events**

Check the following events:

✅ **Payment Events:**
- `payment.captured` - Payment successfully captured
- `payment.failed` - Payment attempt failed
- `payment.authorized` - Payment authorized (for manual capture)

✅ **Refund Events:**
- `refund.created` - Refund initiated
- `refund.processed` - Refund completed
- `refund.failed` - Refund failed

✅ **Order Events (Optional):**
- `order.paid` - Order paid successfully

### **5. Set Secret**

- Click **"Generate Secret"**
- Copy the webhook secret (starts with `whsec_`)
- Save this secret in your **Admin Portal → Payment Gateway Settings**

**Example Secret:**
```
whsec_ABcd1234EFgh5678IJkl9012MNop3456
```

### **6. Activate Webhook**

- Set status to **Active**
- Click **"Create Webhook"**

### **7. Test Webhook**

Razorpay provides a test interface:
- Click on your webhook
- Go to **"Test Webhook"** tab
- Select event type
- Click **"Send Test"**
- Check your server logs for webhook receipt

---

## 🚚 SHIPROCKET WEBHOOK SETUP

### **1. Login to Shiprocket Dashboard**

Visit: https://app.shiprocket.in/

### **2. Navigate to Settings**

- Click on **Settings** (gear icon)
- Select **API** tab
- Scroll to **Webhook Configuration**

### **3. Configure Webhook URL**

**Webhook URL:**
```
https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/logistics/shiprocket/webhook
```

### **4. Select Events**

Enable the following webhooks:

✅ **Shipment Events:**
- `SHIPMENT_STATUS_CHANGED` - Any status change
- `SHIPMENT_DELIVERED` - Successful delivery
- `SHIPMENT_CANCELLED` - Shipment cancelled
- `SHIPMENT_RTO_INITIATED` - Return to origin started
- `SHIPMENT_RTO_DELIVERED` - RTO completed

✅ **NDR Events:**
- `NDR_EVENT` - Non-delivery report (address issue, customer unavailable, etc.)

✅ **Pickup Events (Optional):**
- `PICKUP_SCHEDULED` - Pickup scheduled
- `PICKUP_COMPLETED` - Package picked up

### **5. Save Configuration**

- Click **"Save Settings"**
- Shiprocket will start sending webhook notifications

### **6. Test Webhook**

Create a test shipment to verify:
1. Create a test order in Shiprocket
2. Generate AWB
3. Schedule pickup
4. Check server logs for webhook events

---

## 🔍 WEBHOOK VERIFICATION

### **How to Verify Webhooks are Working**

#### **Razorpay:**

```bash
# Check server logs
tail -f /var/log/supabase-functions.log | grep "Webhook received"

# Expected output:
# 📬 Webhook received: payment.captured for rzp_payment_xxxxx
```

#### **Shiprocket:**

```bash
# Check server logs
tail -f /var/log/supabase-functions.log | grep "Shiprocket webhook"

# Expected output:
# 📬 Shiprocket webhook received: SHIPMENT_STATUS_CHANGED
```

---

## 🧪 MANUAL WEBHOOK TESTING

### **Test Razorpay Webhook**

```bash
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/payments/razorpay/webhook \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: test_signature" \
  -d '{
    "event": "payment.captured",
    "payload": {
      "payment": {
        "entity": {
          "id": "pay_test123",
          "amount": 100000,
          "currency": "INR",
          "status": "captured"
        }
      }
    }
  }'
```

### **Test Shiprocket Webhook**

```bash
curl -X POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/logistics/shiprocket/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "SHIPMENT_STATUS_CHANGED",
    "awb": "TEST123456",
    "current_status": "In Transit"
  }'
```

---

## 🛡️ SECURITY CONSIDERATIONS

### **Razorpay Signature Verification**

Your server automatically verifies Razorpay webhooks using HMAC SHA256:

```typescript
const expectedSignature = crypto.createHmac('sha256', webhookSecret)
  .update(requestBody)
  .digest('hex');

if (expectedSignature !== receivedSignature) {
  // Reject webhook
}
```

### **IP Whitelisting (Optional)**

For added security, whitelist these IPs:

**Razorpay IPs:**
- 3.7.106.88
- 3.7.106.148
- 52.66.125.135

**Shiprocket IPs:**
- Contact Shiprocket support for their webhook server IPs

---

## 📊 WEBHOOK EVENT HANDLING

### **What Happens When Webhook Arrives?**

#### **Payment Captured (Razorpay):**
1. ✅ Verify signature
2. ✅ Update booking status to "confirmed"
3. ✅ Calculate vendor earnings (85% after commission)
4. ✅ Update vendor wallet
5. ✅ Send confirmation email/SMS

#### **Shipment Status Changed (Shiprocket):**
1. ✅ Verify request
2. ✅ Update order tracking status
3. ✅ Store tracking snapshot
4. ✅ Notify customer if delivered
5. ✅ Trigger settlement if delivered

---

## 🚨 TROUBLESHOOTING

### **Webhook Not Received**

**Check 1: URL Correct?**
```bash
# Test endpoint is accessible
curl https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/health
```

**Check 2: Server Running?**
```bash
# Check if function is deployed
supabase functions list
```

**Check 3: Logs**
```bash
# View real-time logs
supabase functions logs make-server-3dd53475 --tail
```

### **Signature Verification Failed**

**Solution:**
- Ensure webhook secret matches exactly
- Check for extra spaces in secret
- Verify test vs live mode secrets

### **Webhook Received but Not Processing**

**Debug:**
```typescript
// Add logging in webhook handler
console.log('Webhook body:', JSON.stringify(event, null, 2));
console.log('Event type:', event.event);
```

---

## ✅ WEBHOOK SETUP CHECKLIST

### **Razorpay:**
- [ ] Logged into Razorpay Dashboard
- [ ] Webhook URL configured
- [ ] Events selected (payment.captured, payment.failed, refund.*)
- [ ] Webhook secret generated
- [ ] Secret saved in Admin Portal
- [ ] Webhook activated
- [ ] Test webhook sent successfully
- [ ] Server logs show webhook receipt

### **Shiprocket:**
- [ ] Logged into Shiprocket Dashboard
- [ ] Webhook URL configured in API settings
- [ ] Events enabled (SHIPMENT_STATUS_CHANGED, SHIPMENT_DELIVERED, NDR_EVENT)
- [ ] Settings saved
- [ ] Test shipment created
- [ ] Webhook events received
- [ ] Server logs show tracking updates

---

## 📞 SUPPORT CONTACTS

**Razorpay Support:**
- Email: support@razorpay.com
- Phone: 1800-120-1234
- Docs: https://razorpay.com/docs/webhooks/

**Shiprocket Support:**
- Email: care@shiprocket.in
- Phone: 1800-120-8500
- Docs: https://apidocs.shiprocket.in/

---

## 🎯 NEXT STEPS AFTER WEBHOOK SETUP

1. ✅ **Test End-to-End Flow** (Step 4)
2. ✅ Create test booking
3. ✅ Process test payment
4. ✅ Verify webhook receipt
5. ✅ Check booking status updated
6. ✅ Verify vendor earnings calculated
7. ✅ Test shipment creation
8. ✅ Verify tracking updates

---

**Setup Complete?** Proceed to **Step 4: End-to-End Testing** →

