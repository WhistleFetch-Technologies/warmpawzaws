# Quick Start - Execute Tests

**Time Required:** 5 minutes to get started

---

## 🚀 3-Step Quick Start

### Step 1: Set Environment Variables (1 min)

```bash
# Set API base URL
export API_BASE="http://localhost:3000/api"

# Set test vendor ID (get from database or create one)
export VENDOR_ID="your-vendor-id-here"

# Optional: Set authentication
export AUTH_TOKEN="your-token"  # OR
export UAT_MODE="true"
export UAT_TOKEN="uat-token-admin"
```

### Step 2: Run Tests (2 min)

```bash
# Quick test
./execute-tests.sh

# Or with options
./execute-tests.sh --api-base "https://api.warmpawz.com/api" --vendor-id "vendor-123"
```

### Step 3: Review Results (2 min)

```bash
# View results
cat test-results-*.log

# Or check summary in terminal output
```

---

## 📋 What Gets Tested

### Automatically Tested:
- ✅ API Health
- ✅ Vendor Profile
- ✅ Dashboard
- ✅ Bookings
- ✅ Services
- ✅ Staff
- ✅ Schedule
- ✅ Analytics
- ✅ Settlements
- ✅ Prescriptions

### Results Include:
- ✅ Pass/Fail status
- ✅ HTTP status codes
- ✅ Response validation
- ✅ Detailed logs

---

## 🎯 Next Steps

1. **Review Results:** Check `test-results-*.log` file
2. **Fix Issues:** Address any failed tests
3. **Expand Tests:** Add more capabilities to test suite
4. **Document:** Update test report with results

---

## 💡 Tips

- **Use UAT Mode:** For testing without full authentication
- **Check Logs:** Review detailed logs for debugging
- **Incremental Testing:** Test one capability at a time
- **Database Verification:** Cross-check API responses with DB

---

**Ready?** Run `./execute-tests.sh` now!
