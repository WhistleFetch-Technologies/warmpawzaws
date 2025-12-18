# Quick Start Configuration Guide

## 🚀 30-Minute Production Setup

### Step 1: Razorpay Webhook Configuration (15 minutes)

1. **Login to Razorpay Dashboard**
   - Go to https://dashboard.razorpay.com
   - Navigate to Settings → Webhooks

2. **Add Webhook URL**
   ```
   https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/razorpay/webhook
   ```

3. **Select Events**
   - ✅ `payment.captured`
   - ✅ `payment.failed`
   - ✅ `refund.created`
   - ✅ `refund.processed`
   - ✅ `transfer.processed`

4. **Copy Webhook Secret**
   - Save the webhook secret (you'll need it for Step 2)

---

### Step 2: Environment Variables Setup (10 minutes)

#### For Supabase Edge Functions (Backend)

Add these to your Supabase project environment variables:

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=your_production_key_id
RAZORPAY_KEY_SECRET=your_production_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_step_1

# Optional: Environment identifier
ENV=production
```

**How to set in Supabase:**
1. Go to Supabase Dashboard → Project Settings → Edge Functions
2. Add environment variables
3. Redeploy functions if needed

#### For Customer Mobile App (Expo/React Native)

Create/update `.env` file in `apps/customer-mobile/`:

```bash
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Or configure via Expo:**
```bash
expo config --type public
# Add EXPO_PUBLIC_SUPABASE_ANON_KEY
```

---

### Step 3: Test Webhook (5 minutes)

#### Manual Test

1. **Create a test payment** through your app
2. **Check Razorpay Dashboard** → Webhooks → Test events
3. **Verify webhook delivery** (should show 200 OK)
4. **Check Supabase logs** for webhook processing

#### Verify Webhook Processing

Check that booking status updates correctly:
- Payment captured → Booking status = "confirmed"
- Payment failed → Booking status = "cancelled"

---

## ✅ Verification Checklist

- [ ] Razorpay webhook URL configured
- [ ] All 5 events selected
- [ ] Webhook secret copied and saved
- [ ] Environment variables set in Supabase
- [ ] Environment variables set in mobile app
- [ ] Test payment completed successfully
- [ ] Webhook received and processed (check logs)
- [ ] Booking status updated correctly

---

## 🔍 Troubleshooting

### Webhook Not Receiving Events

1. **Check webhook URL is correct**
   - Must be publicly accessible
   - Must use HTTPS
   - No trailing slash

2. **Check webhook secret matches**
   - Environment variable must match dashboard

3. **Check Supabase logs**
   - Look for webhook requests
   - Check for signature verification errors

### Payment Flow Not Working

1. **Check Razorpay keys**
   - Verify production keys are set
   - Keys must match environment (test vs production)

2. **Check API responses**
   - Verify payment initiation succeeds
   - Check for error messages in logs

---

## 📝 Quick Reference

### Webhook Endpoint
```
POST https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/razorpay/webhook
```

### Required Environment Variables

**Backend (Supabase):**
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

**Frontend (Mobile App):**
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

---

## 🎯 Next Steps After Configuration

1. ✅ Complete verification checklist above
2. ⚠️ Run one complete end-to-end test
3. ⚠️ Monitor for 24 hours
4. ⚠️ Review error logs
5. ✅ Launch with staged rollout

---

**Estimated Time**: 30 minutes  
**Status**: Ready to configure

