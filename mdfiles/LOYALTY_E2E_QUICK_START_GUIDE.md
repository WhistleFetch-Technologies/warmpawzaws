# Loyalty E2E Test - Quick Start Guide

**Using Approved CloudFront URLs**  
**Infrastructure:** ✅ Complete (No changes needed)

---

## 🌐 **APPROVED URLS**

- **Admin:** https://dfof7mguaa0a5.cloudfront.net
- **Vendor:** https://d1s6ykkj381k58.cloudfront.net  
- **Customer:** https://d2aoyjj8ine0wk.cloudfront.net

---

## ⚡ **QUICK TEST STEPS**

### 1. Admin Dashboard (5 min)
1. Open: https://dfof7mguaa0a5.cloudfront.net
2. Login → Navigate to **Loyalty** → **Action Rules**
3. Find `buy_product` rule → Edit → Link to segment → Save
4. Create vendor → Create product (₹500)

### 2. Customer App (5 min)
1. Open: https://d2aoyjj8ine0wk.cloudfront.net
2. Login → Check **Rewards** (note initial points)
3. Shop → Find product → Add to cart → Checkout → Pay
4. Check **Rewards** again (verify points increased)

### 3. Verify (2 min)
- ✅ Points increased
- ✅ Transaction in history
- ✅ Points match calculation

**Total Time:** ~12 minutes

---

## 📊 **EXPECTED RESULTS**

- **Purchase:** ₹500
- **Points (default):** ~5 points (10 per ₹1000)
- **Points (updated):** ~50 points (10 per ₹100)

---

## ✅ **SUCCESS = Points Awarded!**

**Ready to start?** Begin with Admin Dashboard.

---

**Status:** ✅ Ready  
**Infrastructure:** ✅ Complete
