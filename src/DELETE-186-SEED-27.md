# 🚨 DELETE 186 VENDORS → SEED 27 (Quick Guide)

## ❌ PROBLEM
**Current:** 186 vendors  
**Expected:** 27 vendors (3 per role × 9 roles)

---

## ✅ SOLUTION (3 API Calls)

### **1. DELETE ALL 186 VENDORS** 🗑️

```bash
POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/clear-vendors
Authorization: Bearer {publicAnonKey}
```

**Response:** `"vendorProfiles": 186` (confirms all deleted)

---

### **2. SEED EXACTLY 27 VENDORS** 🌱

```bash
POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/vendors
Authorization: Bearer {publicAnonKey}
```

**Response:** `"success": 27, "failed": 0` (confirms 27 created)

---

### **3. VERIFY CORRECT COUNT** ✅

```bash
GET https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/vendor-count
Authorization: Bearer {publicAnonKey}
```

**Expected Response:**
```json
{
  "totalVendors": 27,
  "byStatus": {
    "approved": 18,
    "pending_approval": 6,
    "rejected": 3
  },
  "byRole": {
    "veterinarian": 3,
    "pet_groomer": 3,
    "pet_trainer": 3,
    "pet_walker": 3,
    "pet_boarder": 3,
    "pet_photographer": 3,
    "pet_pharmacy": 3,
    "pet_clinic": 3,
    "service-provider": 3
  }
}
```

---

## 🎯 ONE-COMMAND OPTION

**Delete 186 + Seed 27 in one call:**

```bash
POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/reset-and-seed
Authorization: Bearer {publicAnonKey}
```

---

## ✅ SUCCESS CRITERIA

After seeding, you MUST have:
- ✅ **Exactly 27 vendors** (not 186!)
- ✅ **3 vendors per role** (9 roles)
- ✅ **18 approved** + 6 pending + 3 rejected
- ✅ **NO "N/A" values** in service category

---

## 📞 TEST LOGINS

| Phone | Name | Role | Status |
|-------|------|------|--------|
| 9876543210 | Dr. Anita Desai | Veterinarian | ✅ Approved |
| 9876543213 | Priya Sharma | Pet Groomer | ✅ Approved |
| 9876543216 | Amit Patel | Pet Trainer | ✅ Approved |
| 9876543219 | Ravi Kumar | Pet Walker | ✅ Approved |
| 9876543212 | Dr. Mohammed Ali | Veterinarian | ⏳ Pending |
| 9876543215 | Sneha Iyer | Pet Groomer | ❌ Rejected |

---

## 🎉 READY FOR UAT!

Once you see **27 vendors**, start testing! 🚀
