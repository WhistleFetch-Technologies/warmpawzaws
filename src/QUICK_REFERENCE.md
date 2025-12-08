# 📋 QUICK REFERENCE CARD

**Warmpawz Payment & Logistics Integration**

---

## 🎯 Quick Status

✅ **All 4 Steps Complete**  
✅ **16 API Endpoints Ready**  
✅ **UI Integrated**  
✅ **Production Ready**

---

## 🔗 Admin Portal Access

```
URL: https://your-domain.com/admin/platform-settings

Tabs:
  1. Cloud & Maps (AWS, Google Maps)
  2. Payment Gateway ← NEW (Razorpay, Stripe, Paytm)
  3. Logistics Integration ← NEW (Shiprocket, Delhivery, BlueDart)
```

---

## 💳 Payment Gateway Quick Setup

**1. Razorpay Dashboard:** https://dashboard.razorpay.com

**2. Get Credentials:**
- Key ID: `rzp_test_xxxxx` or `rzp_live_xxxxx`
- Key Secret: Settings → API Keys
- Webhook Secret: Settings → Webhooks

**3. Configure in Admin Portal:**
```
Admin → Platform Settings → Payment Gateway → Razorpay
  - Enable: ✓
  - Key ID: rzp_test_xxxxx
  - Key Secret: (paste)
  - Webhook Secret: (paste)
  - Auto-capture: ✓
  - Test Mode: ✓ (for testing)
  - Commission: 15%
  - Settlement Period: 3 days
  - Save Settings
```

**4. Setup Webhook:**
```
Razorpay Dashboard → Webhooks → Add New
URL: https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/payments/razorpay/webhook
Events: All payment & refund events
Secret: (copy to Admin Portal)
```

**5. Test:**
```bash
# Create test order
curl -X POST ".../payments/razorpay/create-order" \
  -d '{"bookingId":"test_001","amount":100}'
```

---

## 🚚 Logistics Quick Setup

**1. Shiprocket Dashboard:** https://app.shiprocket.in

**2. Get Credentials:**
- Email: Your registered email
- Password: Your account password

**3. Configure in Admin Portal:**
```
Admin → Platform Settings → Logistics Integration → Shiprocket
  - Enable: ✓
  - Email: merchant@warmpawz.com
  - Password: (enter)
  - Auto-generate AWB: ✓
  - Auto-schedule pickup: ✓
  - Test Mode: ✓ (for testing)
  - Warehouse Name: Main Warehouse
  - Address: 123 Industrial Area
  - City: Bangalore
  - State: Karnataka
  - Pincode: 560001
  - Phone: 9876543210
  - Save Settings
```

**4. Setup Webhook:**
```
Shiprocket Settings → Webhooks
URL: https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/logistics/shiprocket/webhook
Events: All shipment events
```

**5. Test:**
```bash
# Check serviceability
curl ".../logistics/shiprocket/couriers/serviceability?pickupPincode=560001&deliveryPincode=110001&weight=1"
```

---

## 📡 API Endpoints Cheat Sheet

### **Payment APIs (5)**
```
POST /payments/razorpay/create-order      # Create order
POST /payments/razorpay/verify            # Verify payment
POST /payments/razorpay/refund            # Process refund
POST /payments/razorpay/webhook           # Webhook handler
GET  /payments/razorpay/payment/:id       # Get payment details
```

### **Logistics APIs (9)**
```
POST /logistics/shiprocket/create-order             # Create shipment
POST /logistics/shiprocket/generate-awb             # Generate AWB
POST /logistics/shiprocket/schedule-pickup          # Schedule pickup
GET  /logistics/shiprocket/track/:awb               # Track shipment
POST /logistics/shiprocket/create-return            # Create return
GET  /logistics/shiprocket/label/:id                # Get label
GET  /logistics/shiprocket/invoice/:id              # Get invoice
GET  /logistics/shiprocket/couriers/serviceability  # Check delivery
POST /logistics/shiprocket/webhook                  # Webhook handler
```

### **Settings APIs (4)**
```
GET  /admin/settings/payment-gateway      # Get payment settings
POST /admin/settings/payment-gateway      # Save payment settings
GET  /admin/settings/logistics            # Get logistics settings
POST /admin/settings/logistics            # Save logistics settings
```

---

## 🔄 Complete Payment Flow

```
1. Customer places order
   ↓
2. Create Razorpay order
   POST /payments/razorpay/create-order
   ↓
3. Show Razorpay checkout (frontend)
   ↓
4. Customer completes payment
   ↓
5. Verify payment
   POST /payments/razorpay/verify
   ↓
6. Booking confirmed
   ↓
7. Vendor earnings calculated (85%)
   ↓
8. Webhook updates (background)
```

---

## 📦 Complete Logistics Flow

```
1. Order confirmed
   ↓
2. Create shipment
   POST /logistics/shiprocket/create-order
   ↓
3. Generate AWB (auto or manual)
   POST /logistics/shiprocket/generate-awb
   ↓
4. Schedule pickup (auto or manual)
   POST /logistics/shiprocket/schedule-pickup
   ↓
5. Track shipment (real-time)
   GET /logistics/shiprocket/track/:awb
   ↓
6. Delivery completed
   ↓
7. Webhook updates (background)
```

---

## 🧪 Quick Test Commands

**Test Payment:**
```bash
# 1. Save settings
curl -X POST ".../admin/settings/payment-gateway" \
  -H "Content-Type: application/json" \
  -d '{"razorpay":{"enabled":true,"key_id":"rzp_test_xxx"}}'

# 2. Create order
curl -X POST ".../payments/razorpay/create-order" \
  -d '{"bookingId":"test_001","amount":100}'
```

**Test Logistics:**
```bash
# 1. Save settings
curl -X POST ".../admin/settings/logistics" \
  -H "Content-Type: application/json" \
  -d '{"shiprocket":{"enabled":true,"email":"test@ex.com"}}'

# 2. Check serviceability
curl ".../logistics/shiprocket/couriers/serviceability?pickupPincode=560001&deliveryPincode=110001&weight=1"
```

---

## 🐛 Troubleshooting

**Payment not working?**
```
✓ Check Razorpay credentials in Admin Portal
✓ Verify webhook URL in Razorpay Dashboard
✓ Check webhook secret matches
✓ Ensure test mode is enabled for testing
✓ Check browser console for errors
```

**Logistics not working?**
```
✓ Check Shiprocket credentials in Admin Portal
✓ Verify webhook URL in Shiprocket Settings
✓ Ensure warehouse address is configured
✓ Check delivery pincode is serviceable
✓ Verify product weight is specified
```

**Settings not saving?**
```
✓ Check AUTH_TOKEN is valid
✓ Verify server is running
✓ Check browser console for errors
✓ Ensure all required fields are filled
```

---

## 📊 Monitoring

**Check Payment Status:**
```bash
# In Razorpay Dashboard
- Go to Transactions → Payments
- Check payment status
- View webhook logs
```

**Check Shipment Status:**
```bash
# In Shiprocket Dashboard
- Go to Orders → All Orders
- Check shipment status
- View tracking details
```

**Check Server Logs:**
```bash
# In Supabase Dashboard
- Go to Functions → Logs
- Filter by endpoint name
- Check for errors
```

---

## 🔐 Security Checklist

- [x] API keys stored in KV store (not in code)
- [x] Webhook signatures verified
- [x] Passwords masked in UI
- [x] HTTPS only
- [x] Auth tokens required
- [x] Test mode available

---

## 📞 Support Links

**Razorpay:**
- Dashboard: https://dashboard.razorpay.com
- Docs: https://razorpay.com/docs
- Support: https://razorpay.com/support

**Shiprocket:**
- Dashboard: https://app.shiprocket.in
- Docs: https://apidocs.shiprocket.in
- Support: https://support.shiprocket.in

**Warmpawz:**
- Integration Docs: /INTEGRATION_COMPLETE_SUMMARY.md
- Gap Analysis: /P0_CRITICAL_GAPS_FULFILLED.md
- Webhook Setup: /WEBHOOK_SETUP_GUIDE.md

---

## ✅ Final Checklist

**Before Going Live:**
- [ ] Configure production credentials
- [ ] Test payment with real card
- [ ] Test shipment creation
- [ ] Configure production webhooks
- [ ] Disable test mode
- [ ] Monitor first transactions
- [ ] Setup error alerts
- [ ] Document any custom changes

---

**Last Updated:** December 9, 2024  
**Version:** 1.0  
**Status:** ✅ Production Ready

