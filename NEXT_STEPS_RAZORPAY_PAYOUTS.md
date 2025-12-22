# Next Steps: Razorpay Integration & Payout Automation

## Status: ✅ Implementation Complete - Ready for Configuration & Testing

---

## 🚀 Immediate Next Steps

### 1. Configure Razorpay Credentials ⚠️ CRITICAL

**Location:** Supabase Project Secrets

**Steps:**
1. Go to Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Add the following environment variables:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx (or rzp_live_xxxxxxxxxxxxx for production)
   RAZORPAY_KEY_SECRET=your_secret_key_here
   ```
3. **Important:** Use test keys first for sandbox testing
4. Switch to live keys only after thorough testing

**Verification:**
```bash
# Test if credentials are accessible (from Edge Function)
console.log('Razorpay Key ID:', Deno.env.get('RAZORPAY_KEY_ID') ? '✅ Set' : '❌ Missing');
```

---

### 2. Configure Admin Payout Policies ⚠️ REQUIRED

**Endpoint:** Admin Portal → Settings → Payout Policies

**Default Configuration:**
```json
{
  "holdPeriodDays": 7,
  "autoPayout": false,  // Set to true after testing
  "minPayoutAmount": 1000,
  "payoutPeriod": "weekly"
}
```

**Steps:**
1. Access Admin Portal
2. Navigate to Settings → Payment & Refund → Payout Policies
3. Configure:
   - **Hold Period:** Days to hold earnings before payout (default: 7)
   - **Auto Payout:** Enable automatic processing (start with `false` for testing)
   - **Minimum Amount:** Minimum payout threshold (default: ₹1000)
   - **Payout Period:** Frequency (daily/weekly/monthly)

**KV Store Key:** `admin:payout:policies`

---

### 3. Set Up Cron Job Schedule ⚠️ REQUIRED

**Option A: Supabase Edge Function Cron (Recommended)**

Create `supabase/functions/cron.yaml`:
```yaml
schedules:
  - name: process-scheduled-payouts
    schedule: "0 2 * * *"  # Daily at 2 AM IST (UTC: 20:30 previous day)
    endpoint: /make-server-3dd53475/cron/process-scheduled-payouts
    method: POST
    headers:
      Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}
```

**Option B: External Cron Service (e.g., GitHub Actions, Vercel Cron)**

```yaml
# .github/workflows/payout-cron.yml
name: Process Scheduled Payouts
on:
  schedule:
    - cron: '30 20 * * *'  # 2 AM IST (20:30 UTC)
  workflow_dispatch:  # Allow manual trigger

jobs:
  process-payouts:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Payout Processing
        run: |
          curl -X POST \
            https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/cron/process-scheduled-payouts \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

**Option C: Manual Testing (Development)**

```bash
# Test the cron endpoint manually
curl -X POST \
  https://your-project.supabase.co/functions/v1/make-server-3dd53475/cron/process-scheduled-payouts \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

---

### 4. Verify Vendor Bank Account Setup ⚠️ REQUIRED

**For Each Vendor:**
1. Vendor must add bank account details in vendor dashboard
2. Bank account must be verified using Razorpay Fund Account API
3. Verification status stored in: `vendor_bank:${vendorId}`

**Verification Endpoint:** `POST /make-server-3dd53475/razorpay/bank-account/verify`

**Required Fields:**
- Account Number
- IFSC Code
- Account Holder Name

**Status Check:**
```typescript
const vendorBank = await kv.get(`vendor_bank:${vendorId}`);
if (vendorBank && vendorBank.isVerified) {
  // Ready for payouts
}
```

---

## 🧪 Testing Checklist

### Phase 1: Sandbox Testing (Razorpay Test Mode)

#### Test 1: Settlement Creation
- [ ] Complete a booking (verify end OTP)
- [ ] Check settlement record: `settlement:${settlementId}`
- [ ] Verify `razorpayPayoutId` is created
- [ ] Verify `status` is 'settled' or 'failed'
- [ ] Check Razorpay dashboard for payout

#### Test 2: Payout Scheduling
- [ ] Verify payout record created: `payout:${payoutId}`
- [ ] Check `scheduledAt` date is correct (now + holdPeriodDays)
- [ ] Verify payout added to `vendor:${vendorId}:payouts:pending`

#### Test 3: Cron Job Processing
- [ ] Create test payout with past `scheduledAt` date
- [ ] Call cron endpoint manually
- [ ] Verify payout status updated to 'completed'
- [ ] Check Razorpay dashboard for payout
- [ ] Verify vendor notification sent

#### Test 4: Error Handling
- [ ] Test with invalid bank account (should fail gracefully)
- [ ] Test with amount below minimum (should skip)
- [ ] Test with auto-payout disabled (should skip)
- [ ] Verify error messages stored correctly

### Phase 2: Production Testing (Razorpay Live Mode)

**⚠️ IMPORTANT:** Only proceed after successful sandbox testing

- [ ] Switch to live Razorpay keys
- [ ] Test with small amount (₹100-500)
- [ ] Verify actual bank transfer
- [ ] Confirm UTR received
- [ ] Test vendor notification
- [ ] Monitor for 24-48 hours before full rollout

---

## 📊 Monitoring & Maintenance

### 1. Daily Monitoring

**Check Payout Status:**
```bash
GET /make-server-3dd53475/cron/payout-status
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "autoPayoutEnabled": true,
    "pendingCount": 15,
    "pendingAmount": 45000,
    "minPayoutAmount": 1000,
    "holdPeriodDays": 7
  }
}
```

### 2. Failed Settlement Monitoring

**Query Failed Settlements:**
```typescript
// Get all settlements with status 'failed'
const allSettlements = await kv.getByPrefix('settlement:');
const failedSettlements = allSettlements.filter(s => s.status === 'failed');
```

**Retry Failed Settlements:**
- Create admin endpoint to retry failed settlements
- Check `retryCount` before retrying
- Set max retry limit (e.g., 3 attempts)

### 3. Failed Payout Monitoring

**Query Failed Payouts:**
```typescript
// Get all payouts with status 'failed'
const allPayouts = await kv.getByPrefix('payout:');
const failedPayouts = allPayouts.filter(p => p.status === 'failed');
```

**Manual Retry:**
- Admin can manually retry failed payouts
- Check `failureReason` for debugging
- Verify vendor bank account before retry

### 4. Log Monitoring

**Key Log Patterns to Monitor:**
- `✅ [SETTLEMENT] Razorpay payout created` - Success
- `❌ [SETTLEMENT] Razorpay payout failed` - Error
- `✅ [PAYOUT-CRON] Payout processed successfully` - Success
- `❌ [PAYOUT-CRON] Failed to process payout` - Error

**Set Up Alerts:**
- Alert on high failure rate (>5%)
- Alert on cron job failures
- Alert on Razorpay API errors

---

## 🔧 Troubleshooting

### Issue 1: Razorpay API Authentication Failed

**Symptoms:**
- Error: `Razorpay payout failed: {"error": {...}}`
- Settlement status: 'failed'

**Solutions:**
1. Verify `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set correctly
2. Check if keys are for correct environment (test vs live)
3. Verify keys are not expired or revoked
4. Check Razorpay dashboard for API access status

### Issue 2: Bank Account Verification Failed

**Symptoms:**
- Settlement status: 'pending_verification'
- Payout skipped: "Vendor bank not verified"

**Solutions:**
1. Verify vendor has added bank account details
2. Check bank account verification endpoint
3. Verify IFSC code is correct
4. Check Razorpay Fund Account API response

### Issue 3: Cron Job Not Running

**Symptoms:**
- Payouts remain in 'scheduled' status
- No cron job logs

**Solutions:**
1. Verify cron job is configured correctly
2. Check cron job schedule (timezone)
3. Verify service role key has correct permissions
4. Test cron endpoint manually
5. Check Supabase Edge Function logs

### Issue 4: Payout Below Minimum Amount

**Symptoms:**
- Payout skipped: "Amount below minimum"

**Solutions:**
1. Check `minPayoutAmount` in admin settings
2. Consider lowering threshold for testing
3. Accumulate earnings until threshold reached
4. Allow manual payout for small amounts

---

## 📋 Production Readiness Checklist

### Configuration
- [ ] Razorpay credentials set (live keys)
- [ ] Admin payout policies configured
- [ ] Cron job scheduled and tested
- [ ] Vendor bank accounts verified

### Testing
- [ ] Sandbox testing completed
- [ ] Production testing with small amounts
- [ ] Error handling verified
- [ ] Notifications working

### Monitoring
- [ ] Log monitoring set up
- [ ] Alerts configured
- [ ] Dashboard for payout status
- [ ] Failed payout retry process

### Documentation
- [ ] Admin guide for payout management
- [ ] Vendor guide for bank account setup
- [ ] Troubleshooting guide
- [ ] API documentation updated

---

## 🎯 Success Metrics

**Track These Metrics:**
1. **Settlement Success Rate:** % of settlements successfully processed
2. **Payout Success Rate:** % of payouts successfully completed
3. **Average Payout Time:** Time from booking completion to payout
4. **Failed Payout Rate:** % of payouts that fail
5. **Retry Success Rate:** % of retried payouts that succeed

**Target Metrics:**
- Settlement Success Rate: >95%
- Payout Success Rate: >98%
- Average Payout Time: <24 hours (after hold period)
- Failed Payout Rate: <2%
- Retry Success Rate: >80%

---

## 📞 Support & Escalation

### Razorpay Support
- **Dashboard:** https://dashboard.razorpay.com
- **API Docs:** https://razorpay.com/docs/api/
- **Support:** support@razorpay.com

### Internal Escalation
1. **Level 1:** Check logs and retry
2. **Level 2:** Verify configuration and credentials
3. **Level 3:** Contact Razorpay support
4. **Level 4:** Manual intervention required

---

## 🚀 Rollout Plan

### Week 1: Sandbox Testing
- Configure test Razorpay account
- Test with 5-10 vendors
- Monitor all transactions
- Fix any issues

### Week 2: Limited Production
- Switch to live Razorpay keys
- Enable for 10-20 vendors
- Process small payouts (₹500-1000)
- Monitor closely

### Week 3: Full Rollout
- Enable for all vendors
- Process all scheduled payouts
- Monitor metrics
- Gather feedback

### Week 4: Optimization
- Analyze metrics
- Optimize hold periods
- Fine-tune minimum amounts
- Improve error handling

---

**Last Updated:** Current Session
**Status:** ✅ Ready for Configuration & Testing

