# 🚨 UAT RESET - DELETE ALL 186 VENDORS & SEED EXACTLY 27

## ❌ CURRENT PROBLEM
- **Current vendor count:** 186 vendors (way too many!)
- **Expected vendor count:** 27 vendors (3 per role × 9 roles)

## ✅ SOLUTION - 3 SIMPLE API CALLS

Follow these steps **IN ORDER** to completely reset your UAT environment:

---

## 📋 STEP-BY-STEP RESET PROCESS

### **STEP 1: Check Current Vendor Count** 🔍

**Endpoint:**
```
GET https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/vendor-count
Authorization: Bearer {publicAnonKey}
```

**Expected Response:**
```json
{
  "success": true,
  "totalVendors": 186,
  "totalRecords": 186,
  "byStatus": {
    "approved": 124,
    "pending_approval": 42,
    "rejected": 20
  },
  "byRole": {
    "veterinarian": 62,
    "pet_groomer": 41,
    ...
  }
}
```

---

### **STEP 2: DELETE ALL VENDORS** 🗑️

**Endpoint:**
```
POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/clear-vendors
Authorization: Bearer {publicAnonKey}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "All vendor data cleared",
  "results": {
    "success": true,
    "report": {
      "vendorProfiles": 186,
      "phoneIndexes": 186,
      "userIndexes": 186,
      "vendorUsers": 186,
      "vendorServices": 0,
      "vendorAvailability": 0
    }
  }
}
```

**What This Does:**
- ✅ Deletes all 186 vendor profiles
- ✅ Deletes all phone indexes (`vendor:phone:xxx`)
- ✅ Deletes all user indexes (`vendor:user:xxx`)
- ✅ Deletes all vendor user accounts
- ✅ Deletes all vendor services
- ✅ Deletes all availability records
- ✅ Clears pending/approved/rejected lists

**Console Output:**
```
🗑️  ========== CLEARING ALL VENDORS ==========

Found 186 vendor profiles to delete
  Processing vendor: vendor_123 (Dr. Anita Desai)
  Processing vendor: vendor_456 (Priya Sharma)
  ... (repeat 186 times)

✅ ========== ALL VENDOR DATA CLEARED ==========

📊 Deletion Report:
  - Vendor Profiles: 186
  - Phone Indexes: 186
  - User Indexes: 186
  - Vendor User Accounts: 186
  - Vendor Services: 0
  - Availability Records: 0
```

---

### **STEP 3: Verify Deletion** ✅

**Endpoint:**
```
GET https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/vendor-count
Authorization: Bearer {publicAnonKey}
```

**Expected Response:**
```json
{
  "success": true,
  "totalVendors": 0,
  "totalRecords": 0,
  "byStatus": {},
  "byRole": {}
}
```

**🎯 SUCCESS:** All vendors deleted!

---

### **STEP 4: Seed EXACTLY 27 Vendors** 🌱

**Endpoint:**
```
POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/vendors
Authorization: Bearer {publicAnonKey}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Vendor seeding complete",
  "results": {
    "success": 27,
    "failed": 0,
    "errors": []
  }
}
```

**Console Output:**
```
🌱 ========== SEEDING VENDORS (COMPREHENSIVE UAT DATA) ==========

📊 Total vendors to create: 27

📝 Creating vendor: Dr. Anita Desai (9876543210)
  Step 1: Cleaned phone: 9876543210
  Step 2: Creating user account...
    ✅ Created user: user_1234567890_abc123
  Step 3: Generated vendor ID: vendor_1234567890_abc123
  Step 4: Fetching role configuration...
    📋 Role: Veterinarian, VendorType: healthcare_provider
  Step 5: Creating vendor profile...
    ✅ Saved: vendor:vendor_1234567890_abc123
    ✅ Created indexes
  ✅✅✅ SUCCESS: Dr. Anita Desai created!

... (repeat 27 times) ...

🎉 ========== SEEDING COMPLETE ==========
📊 Total vendors in seed: 27
✅ Success: 27
❌ Failed: 0
```

---

### **STEP 5: Verify Correct Count** ✅

**Endpoint:**
```
GET https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/vendor-count
Authorization: Bearer {publicAnonKey}
```

**Expected Response:**
```json
{
  "success": true,
  "totalVendors": 27,
  "totalRecords": 27,
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

**🎯 SUCCESS:** Exactly 27 vendors created!

---

## 📊 27 VENDORS BREAKDOWN

### **By Role (3 each):**
1. **Veterinarian** (3) - Dr. Anita Desai, Dr. Rajesh Kumar, Dr. Mohammed Ali
2. **Pet Groomer** (3) - Priya Sharma, Karthik Reddy, Sneha Iyer
3. **Pet Trainer** (3) - Amit Patel, Meera Nair, Vikram Singh
4. **Pet Walker** (3) - Ravi Kumar, Lakshmi Menon, Arjun Rao
5. **Pet Boarder** (3) - Neha Gupta, Suresh Babu, Divya Krishnan
6. **Pet Photographer** (3) - Rohan Mehta, Kavya Reddy, Sanjay Verma
7. **Pet Pharmacy** (3) - Dr. Sunita Agarwal, Ramesh Choudhary, Anjali Shah
8. **Pet Clinic** (3) - Dr. Arun Krishnan, Dr. Pooja Malhotra, Dr. Sameer Joshi
9. **Service Provider** (3) - Manish Kapoor, Deepa Srinivasan, Harish Menon

### **By Status:**
- ✅ **Approved:** 18 vendors (ready for setup)
- ⏳ **Pending:** 6 vendors (need admin approval)
- ❌ **Rejected:** 3 vendors (for testing rejection flow)

### **By Service Style:**
- 🏠 **At Home:** ~9 vendors
- 🏢 **At Center:** ~12 vendors
- 🏠🏢 **Both:** ~6 vendors

---

## 🚀 ONE-COMMAND RESET (OPTIONAL)

If you want to do everything in one API call:

**Endpoint:**
```
POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed/reset-and-seed
Authorization: Bearer {publicAnonKey}
```

This will:
1. ✅ Delete all existing vendors (186)
2. ✅ Seed exactly 27 new vendors
3. ✅ Return combined results

**Expected Response:**
```json
{
  "success": true,
  "message": "Reset and re-seed complete",
  "results": {
    "cleared": {
      "success": true,
      "report": {
        "vendorProfiles": 186,
        "phoneIndexes": 186,
        ...
      }
    },
    "seeded": {
      "success": 27,
      "failed": 0,
      "errors": []
    }
  }
}
```

---

## ✅ POST-SEED VERIFICATION CHECKLIST

### **1. Check Admin Portal**
Navigate to: **Admin Portal** → **Vendor Administration** → **New Vendor Applications**

You should see:
- ✅ **Total Vendors:** 27 (NOT 186!)
- ✅ **Approved:** 18
- ✅ **Pending:** 6
- ✅ **Rejected:** 3

### **2. Verify NO "N/A" Values**
Every vendor should have:
- ✅ **Service Category:** `healthcare_provider`, `service_provider`, or `seller` (NOT "N/A")
- ✅ **Vendor Type:** Same as service category
- ✅ **Role Name:** "Veterinarian", "Pet Groomer", etc. (NOT "N/A")

### **3. Filter Tests**
- ✅ Filter by **Healthcare Providers** → Should show 6 vendors (3 Vets + 3 Clinics)
- ✅ Filter by **Service Providers** → Should show 18 vendors
- ✅ Filter by **Product Sellers** → Should show 3 vendors (Pharmacies)
- ✅ Filter by **Approved** → Should show 18 vendors
- ✅ Filter by **Pending** → Should show 6 vendors

### **4. Test Logins**
Try logging into Vendor App with:
- 📞 **9876543210** (Dr. Anita Desai - Veterinarian - Approved)
- 📞 **9876543213** (Priya Sharma - Pet Groomer - Approved)
- 📞 **9876543216** (Amit Patel - Pet Trainer - Approved)

---

## 📞 QUICK TEST LOGIN PHONES

| Phone | Vendor Name | Role | Status |
|-------|-------------|------|--------|
| 9876543210 | Dr. Anita Desai | Veterinarian | ✅ Approved |
| 9876543211 | Dr. Rajesh Kumar | Veterinarian | ✅ Approved |
| 9876543212 | Dr. Mohammed Ali | Veterinarian | ⏳ Pending |
| 9876543213 | Priya Sharma | Pet Groomer | ✅ Approved |
| 9876543214 | Karthik Reddy | Pet Groomer | ✅ Approved |
| 9876543215 | Sneha Iyer | Pet Groomer | ❌ Rejected |
| 9876543216 | Amit Patel | Pet Trainer | ✅ Approved |
| 9876543217 | Meera Nair | Pet Trainer | ✅ Approved |
| 9876543218 | Vikram Singh | Pet Trainer | ⏳ Pending |
| 9876543219 | Ravi Kumar | Pet Walker | ✅ Approved |
| 9876543220 | Lakshmi Menon | Pet Walker | ✅ Approved |
| 9876543221 | Arjun Rao | Pet Walker | ❌ Rejected |

---

## 🎯 SUCCESS CRITERIA

After reset and seed, you MUST have:

1. ✅ **Exactly 27 vendors** (not 186, not 0, not any other number!)
2. ✅ **3 vendors per role type** (9 roles)
3. ✅ **NO "N/A" values** anywhere
4. ✅ **18 approved** + 6 pending + 3 rejected
5. ✅ **All vendors inactive** (setupCompleted: false)
6. ✅ **Sequential phone numbers** (9876543210-9876543236)
7. ✅ **Proper role mappings** (roleId matches role config)
8. ✅ **Correct service categories** (no hardcoded values)

---

## 🚨 TROUBLESHOOTING

### **Problem: Still seeing 186 vendors after clear**
**Solution:** 
- Make sure you called the CLEAR endpoint
- Check response to confirm deletion count
- Call vendor-count endpoint to verify

### **Problem: Seeding creates duplicates**
**Solution:**
- Always CLEAR before SEED
- Don't call seed endpoint multiple times
- Use reset-and-seed endpoint for atomic operation

### **Problem: Some vendors still show "N/A"**
**Solution:**
- Make sure roles were seeded FIRST
- Check that roleId in seed matches role config
- Verify role config has vendorTypes array

---

## 🎉 YOU'RE READY FOR UAT!

Once you have **exactly 27 vendors**, you can start comprehensive UAT testing:

### **Admin Portal Testing:**
- ✅ View all 27 vendors
- ✅ Filter by category/status/style
- ✅ Approve pending vendors (6 available)
- ✅ Reject vendors
- ✅ View vendor details
- ✅ Add admin notes

### **Vendor App Testing:**
- ✅ Login with test phones
- ✅ Complete setup flow
- ✅ Configure services (filtered by role!)
- ✅ Set availability
- ✅ Go live

### **Customer App Testing:**
- ✅ Search vendors
- ✅ Filter by service type
- ✅ Book services
- ✅ Rate vendors

---

## 📝 QUICK COMMAND REFERENCE

```bash
# 1. Check current count
GET /admin/seed/vendor-count

# 2. Delete all vendors
POST /admin/seed/clear-vendors

# 3. Verify deletion
GET /admin/seed/vendor-count

# 4. Seed exactly 27
POST /admin/seed/vendors

# 5. Verify correct count
GET /admin/seed/vendor-count

# OR: One command to do it all
POST /admin/seed/reset-and-seed
```

---

## ✅ EXPECTED FINAL STATE

```
Total Vendors: 27

By Role:
├─ Veterinarian: 3
├─ Pet Groomer: 3
├─ Pet Trainer: 3
├─ Pet Walker: 3
├─ Pet Boarder: 3
├─ Pet Photographer: 3
├─ Pet Pharmacy: 3
├─ Pet Clinic: 3
└─ Service Provider: 3

By Status:
├─ Approved: 18
├─ Pending: 6
└─ Rejected: 3

By Category:
├─ Healthcare Providers: 6
├─ Service Providers: 18
└─ Product Sellers: 3
```

**NOW YOU CAN START UAT TESTING!** 🚀
