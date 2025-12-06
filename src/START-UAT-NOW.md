# 🚀 START UAT NOW - Simple Guide

## 🎯 YOUR MISSION
**Delete 186 vendors → Seed exactly 27 vendors → Start UAT testing**

---

## ⚡ FASTEST METHOD (1 API Call)

```bash
POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/reset-and-seed
Authorization: Bearer {publicAnonKey}
```

**This does EVERYTHING:**
1. ✅ Deletes all 186 vendors
2. ✅ Seeds exactly 27 new vendors
3. ✅ Returns confirmation

**Expected Response:**
```json
{
  "success": true,
  "results": {
    "cleared": { "vendorProfiles": 186 },
    "seeded": { "success": 27, "failed": 0 }
  }
}
```

---

## ✅ VERIFY IT WORKED

```bash
GET https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/vendor-count
Authorization: Bearer {publicAnonKey}
```

**Must show:**
```json
{
  "totalVendors": 27,
  "byStatus": {
    "approved": 18,
    "pending_approval": 6,
    "rejected": 3
  }
}
```

---

## 🎉 DONE! NOW TEST

### **Admin Portal:**
- Open Admin Portal
- Go to Vendor Administration
- You should see **27 vendors** (not 186!)
- Try filtering by status/category

### **Vendor App:**
Login with:
- **9876543210** (Dr. Anita Desai - Approved Vet)
- **9876543213** (Priya Sharma - Approved Groomer)
- **9876543216** (Amit Patel - Approved Trainer)

### **Customer App:**
- Search for vendors
- Should see 18 approved vendors
- Filter by category

---

## 📊 WHAT YOU GET

**27 Vendors:**
- 3 Veterinarians
- 3 Pet Groomers
- 3 Pet Trainers
- 3 Pet Walkers
- 3 Pet Boarders
- 3 Pet Photographers
- 3 Pet Pharmacies
- 3 Pet Clinics
- 3 Service Providers

**Status Mix:**
- 18 Approved ✅
- 6 Pending ⏳
- 3 Rejected ❌

---

## 🎯 SUCCESS = 27 VENDORS

**If vendor count = 27 → START UAT TESTING! 🚀**

**If vendor count ≠ 27 → Run reset-and-seed again**

---

That's it! Simple and ready to go! 🐾
