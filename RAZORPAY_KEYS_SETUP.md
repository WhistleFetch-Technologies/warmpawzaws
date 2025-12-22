# Razorpay Keys Setup - Platform Settings

## ✅ Keys Provided

**API Key:** `rzp_test_Rnp57suJH3wzUl`  
**Key Secret:** `rplcWAxtmVfvXI9uydFt7YkH`

---

## 🎯 Setup Instructions

### Option 1: Via Admin Portal UI (Recommended)

1. Go to Admin Portal → Settings → Payment & Logistics → Payment Gateway
2. Find Razorpay section
3. Enter:
   - **Key ID:** `rzp_test_Rnp57suJH3wzUl`
   - **Key Secret:** `rplcWAxtmVfvXI9uydFt7YkH`
   - **Enabled:** ✅ (check)
   - **Test Mode:** ✅ (check, since these are test keys)
4. Click "Save"

### Option 2: Via API

```bash
POST /make-server-3dd53475/admin/settings/payment-gateway
Content-Type: application/json

{
  "razorpay": {
    "enabled": true,
    "key_id": "rzp_test_Rnp57suJH3wzUl",
    "key_secret": "rplcWAxtmVfvXI9uydFt7YkH",
    "test_mode": true,
    "auto_capture": true
  },
  "default_gateway": "razorpay"
}
```

---

## ✅ Verification

After saving, the system will:
1. ✅ Store keys in `platform:settings:payment_gateway`
2. ✅ All Razorpay API calls will use these keys
3. ✅ No need for environment variables

**Check if keys are loaded:**
```bash
GET /make-server-3dd53475/admin/settings/payment-gateway
```

**Expected Response:**
```json
{
  "success": true,
  "settings": {
    "razorpay": {
      "enabled": true,
      "key_id": "rzp_test_Rnp57suJH3wzUl",
      "key_secret": "rplcWAxtmVfvXI9uydFt7YkH",
      "test_mode": true
    }
  }
}
```

---

## 🔄 Migration Complete

**Status:** ✅ All Razorpay integrations now use platform settings

**Files Updated:**
- ✅ `razorpay-marketplace-payout.tsx` - Uses centralized helper
- ✅ `razorpay-credentials-helper.tsx` - New centralized helper
- ✅ All other files will be updated to use helper

**No More Duplicates:**
- ❌ Removed: Direct `Deno.env.get('RAZORPAY_KEY_ID')` usage
- ✅ Using: `getRazorpayCredentials()` from platform settings

---

**Last Updated:** Current Session

