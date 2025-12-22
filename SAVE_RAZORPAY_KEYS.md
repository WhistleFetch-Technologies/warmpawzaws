# Save Razorpay Keys to Platform Settings

## ✅ Keys to Save

**API Key:** `rzp_test_Rnp57suJH3wzUl`  
**Key Secret:** `rplcWAxtmVfvXI9uydFt7YkH`

---

## 🚀 Quick Setup (API Call)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/make-server-3dd53475/admin/settings/payment-gateway \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{
    "razorpay": {
      "enabled": true,
      "key_id": "rzp_test_Rnp57suJH3wzUl",
      "key_secret": "rplcWAxtmVfvXI9uydFt7YkH",
      "test_mode": true,
      "auto_capture": true
    },
    "default_gateway": "razorpay"
  }'
```

---

## ✅ Verification

After saving, verify keys are stored:

```bash
curl -X GET https://your-project.supabase.co/functions/v1/make-server-3dd53475/admin/settings/payment-gateway \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
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

## 🎯 What Happens Next

Once keys are saved:
1. ✅ All Razorpay API calls will use these keys
2. ✅ No need for environment variables
3. ✅ Admin can update keys via UI anytime
4. ✅ Changes take effect immediately

---

**Status:** Ready to save keys

