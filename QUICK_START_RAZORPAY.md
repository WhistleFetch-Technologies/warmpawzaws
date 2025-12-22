# Quick Start: Razorpay Integration

## 🚀 5-Minute Setup Guide

### Step 1: Set Razorpay Credentials (2 minutes)

```bash
# In Supabase Dashboard → Project Settings → Edge Functions → Secrets
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_secret_key_here
```

### Step 2: Configure Payout Policies (1 minute)

```bash
# Via Admin Portal or API
POST /admin/payout/policies
{
  "holdPeriodDays": 7,
  "autoPayout": false,  # Set to true after testing
  "minPayoutAmount": 1000,
  "payoutPeriod": "weekly"
}
```

### Step 3: Test Settlement (1 minute)

1. Complete a booking (verify end OTP)
2. Check settlement: `GET /settlement/${settlementId}`
3. Verify `razorpayPayoutId` exists

### Step 4: Test Cron Job (1 minute)

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/make-server-3dd53475/cron/process-scheduled-payouts \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Step 5: Monitor Status

```bash
GET /cron/payout-status
```

---

## ✅ Done!

Your Razorpay integration is now configured and ready for testing.

**Next:** Follow the full testing checklist in `NEXT_STEPS_RAZORPAY_PAYOUTS.md`

