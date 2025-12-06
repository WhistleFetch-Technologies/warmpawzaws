# 🌱 COMPREHENSIVE UAT SEEDING - 27 VENDORS (3 per Role)

## ✅ YOU WERE ABSOLUTELY RIGHT!

You asked for **3 vendors per role type**, which means:
- **9 role types** configured in system
- **3 vendors per role**
- **Total: 27 vendors** ✅

Previously the seed only had **4 vendors total** - completely insufficient for UAT! 

## 📊 NEW COMPREHENSIVE SEED DATA

### **27 Vendors Created:**

| # | Role Type | Vendor Name | Business Name | Status | Service Style |
|---|-----------|-------------|---------------|--------|---------------|
| **VETERINARIAN (3)** |
| 1 | Veterinarian | Dr. Anita Desai | Paws & Claws Veterinary Clinic | ✅ Approved | Both |
| 2 | Veterinarian | Dr. Rajesh Kumar | Pet Care Plus Veterinary Hospital | ✅ Approved | At Center |
| 3 | Veterinarian | Dr. Mohammed Ali | Pet Care Clinic | ⏳ Pending | At Center |
| **PET GROOMER (3)** |
| 4 | Pet Groomer | Priya Sharma | Happy Paws Grooming | ✅ Approved | At Center |
| 5 | Pet Groomer | Karthik Reddy | Furry Friends Grooming Salon | ✅ Approved | At Home |
| 6 | Pet Groomer | Sneha Iyer | Paws Perfection | ❌ Rejected | Both |
| **PET TRAINER (3)** |
| 7 | Pet Trainer | Amit Patel | Pro Pet Training Academy | ✅ Approved | At Home |
| 8 | Pet Trainer | Meera Nair | Canine Masters Training | ✅ Approved | At Center |
| 9 | Pet Trainer | Vikram Singh | Alpha Dog Training | ⏳ Pending | Both |
| **PET WALKER (3)** |
| 10 | Pet Walker | Ravi Kumar | - | ✅ Approved | At Home |
| 11 | Pet Walker | Lakshmi Menon | - | ✅ Approved | At Home |
| 12 | Pet Walker | Arjun Rao | - | ❌ Rejected | At Home |
| **PET BOARDER (3)** |
| 13 | Pet Boarder | Neha Gupta | Cozy Paws Boarding | ✅ Approved | At Center |
| 14 | Pet Boarder | Suresh Babu | Pet Paradise Boarding | ✅ Approved | At Center |
| 15 | Pet Boarder | Divya Krishnan | Happy Tails Boarding | ⏳ Pending | At Center |
| **PET PHOTOGRAPHER (3)** |
| 16 | Pet Photographer | Rohan Mehta | Pet Portraits Studio | ✅ Approved | At Center |
| 17 | Pet Photographer | Kavya Reddy | Furry Frames Photography | ✅ Approved | Both |
| 18 | Pet Photographer | Sanjay Verma | Pawfect Moments | ❌ Rejected | At Home |
| **PET PHARMACY (3)** |
| 19 | Pet Pharmacy | Dr. Sunita Agarwal | Pet Meds Pharmacy | ✅ Approved | At Center |
| 20 | Pet Pharmacy | Ramesh Choudhary | Pawsitive Health Pharmacy | ✅ Approved | At Center |
| 21 | Pet Pharmacy | Anjali Shah | VetCare Pharmacy | ⏳ Pending | At Center |
| **PET CLINIC (3)** |
| 22 | Pet Clinic | Dr. Arun Krishnan | Comprehensive Pet Care Clinic | ✅ Approved | At Center |
| 23 | Pet Clinic | Dr. Pooja Malhotra | All Pets Multispecialty Clinic | ✅ Approved | Both |
| 24 | Pet Clinic | Dr. Sameer Joshi | Pet Wellness Center | ❌ Rejected | At Center |
| **SERVICE PROVIDER (Generic - 3)** |
| 25 | Service Provider | Manish Kapoor | Pet Services Hub | ✅ Approved | Both |
| 26 | Service Provider | Deepa Srinivasan | Complete Pet Care | ✅ Approved | At Center |
| 27 | Service Provider | Harish Menon | Pet Care Solutions | ⏳ Pending | At Home |

---

## 📋 STATUS BREAKDOWN

- **✅ Approved:** 18 vendors
- **⏳ Pending Approval:** 6 vendors
- **❌ Rejected:** 3 vendors
- **Total:** 27 vendors

This gives you comprehensive UAT data covering:
- ✅ All major vendor types
- ✅ Different approval statuses
- ✅ Different service styles (at_home, at_center, both)
- ✅ With/without business names
- ✅ With/without GST numbers
- ✅ Different cities and locations

---

## 🎯 ROLE → SERVICE CATEGORY MAPPING

Each vendor is properly configured with:

| Role ID | Role Name | Vendor Type | Service Category |
|---------|-----------|-------------|------------------|
| `veterinarian` | Veterinarian | `healthcare_provider` | Healthcare Providers |
| `pet_groomer` | Pet Groomer | `service_provider` | Service Providers |
| `pet_trainer` | Pet Trainer | `service_provider` | Service Providers |
| `pet_walker` | Pet Walker | `service_provider` | Service Providers |
| `pet_boarder` | Pet Boarder | `service_provider` | Service Providers |
| `pet_photographer` | Pet Photographer | `service_provider` | Service Providers |
| `pet_pharmacy` | Pet Pharmacy | `seller` | Product Sellers |
| `pet_clinic` | Pet Clinic | `healthcare_provider` | Healthcare Providers |
| `service-provider` | Service Provider | `service_provider` | Service Providers |

---

## ⚡ HOW TO SEED

### **Step 1: Seed Roles** (MUST DO FIRST!)

```bash
POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles/seed
Authorization: Bearer {publicAnonKey}
```

Expected:
```json
{
  "success": true,
  "seeded": 9,
  "total": 9
}
```

---

### **Step 2: Clear Old Vendors** (If any exist)

```bash
POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/seed/vendors/clear
Authorization: Bearer {publicAnonKey}
```

Expected:
```json
{
  "success": true,
  "report": {
    "vendorProfiles": 4,
    "phoneIndexes": 4,
    ...
  }
}
```

---

### **Step 3: Seed 27 Vendors**

```bash
POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/seed/vendors
Authorization: Bearer {publicAnonKey}
```

Expected:
```json
{
  "success": 27,
  "failed": 0,
  "errors": []
}
```

**Console Log Output:**
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

... (repeat for all 27 vendors) ...

🎉 ========== SEEDING COMPLETE ==========
📊 Total vendors in seed: 27
✅ Success: 27
❌ Failed: 0
```

---

## ✅ VERIFY THE RESULTS

### **1. Check Admin Portal**

Navigate to: **Admin Portal** → **Vendor Administration** → **New Vendor Applications**

You should see:
- **Total Vendors:** 27
- **By Status:**
  - Approved: 18
  - Pending Approval: 6
  - Rejected: 3

### **2. Check Service Categories**

Filter by category:
- **Healthcare Providers:** 6 vendors (3 Veterinarians + 3 Pet Clinics)
- **Service Providers:** 18 vendors (Groomers, Trainers, Walkers, etc.)
- **Product Sellers:** 3 vendors (Pet Pharmacies)

### **3. Check Service Styles**

Filter by style:
- **At Home:** ~9 vendors
- **At Center:** ~12 vendors
- **Both:** ~6 vendors

### **4. Verify NO "N/A" Values**

Every vendor should have:
- ✅ **Service Category:** `healthcare_provider`, `service_provider`, or `seller` (NOT "N/A")
- ✅ **Vendor Type:** Same as service category
- ✅ **Role Name:** "Veterinarian", "Pet Groomer", etc. (NOT "N/A")

---

## 🔍 SAMPLE VENDOR DATA

Here's what a seeded vendor looks like in the database:

```json
{
  "id": "vendor_1234567890_abc123",
  "userId": "user_1234567890_abc123",
  "fullName": "Dr. Anita Desai",
  "businessName": "Paws & Claws Veterinary Clinic",
  "phone": "9876543210",
  "email": "anita.desai@pawsclaws.com",
  
  "roleId": "veterinarian",
  "roleName": "Veterinarian",
  "vendorType": "healthcare_provider",
  "serviceCategory": "healthcare_provider",
  "serviceStyle": "both",
  
  "status": "approved",
  "setupCompleted": false,
  "isActive": false,
  
  "experience": "15 years",
  "address": "123 MG Road, Bangalore, Karnataka 560001",
  "city": "Bangalore",
  "coordinates": { "lat": 12.9716, "lng": 77.5946 },
  
  "aadhaarNumber": "1234-5678-9010",
  "panNumber": "ABCDE1234F",
  "gstNumber": "29ABCDE1234F1Z5",
  
  "rating": 0,
  "totalReviews": 0,
  "completedBookings": 0,
  
  "createdAt": "2024-11-16T10:30:00.000Z",
  "submittedAt": "2024-11-16T10:30:00.000Z",
  "updatedAt": "2024-11-16T10:30:00.000Z"
}
```

---

## 📊 WHAT THIS GIVES YOU FOR UAT

### **1. Comprehensive Role Coverage**
- 9 different role types
- 3 vendors per role
- Tests all vendor configurations

### **2. Status Variety**
- Approved vendors (can test setup flow)
- Pending vendors (can test approval flow)
- Rejected vendors (can test rejection flow)

### **3. Service Style Variety**
- At Home services (requires police verification)
- At Center services (requires facility details)
- Both (hybrid model)

### **4. Business Type Variety**
- Individual vendors (Pet Walkers - no business name)
- Small businesses (Groomers)
- Large enterprises (Pet Clinics)

### **5. Document Variety**
- Some with GST (businesses)
- Some without GST (individuals)
- All with mandatory Aadhar + PAN

### **6. Geographic Spread**
- All across Bangalore
- Different localities (Indiranagar, Koramangala, Whitefield, etc.)
- Realistic coordinates for map testing

---

## 🎯 UAT TEST SCENARIOS ENABLED

With 27 vendors, you can now test:

### **Admin Portal:**
1. ✅ View all 27 vendors
2. ✅ Filter by status (Approved/Pending/Rejected)
3. ✅ Filter by category (Healthcare/Service/Products)
4. ✅ Filter by service style (Home/Center/Both)
5. ✅ Approve pending vendors (6 available)
6. ✅ Reject vendors with reasons (test on pending)
7. ✅ View vendor details
8. ✅ View documents
9. ✅ Add admin notes

### **Vendor App:**
1. ✅ Login as approved vendor
2. ✅ See setup incomplete message
3. ✅ Configure services (filtered by role)
4. ✅ Set availability
5. ✅ Complete profile setup
6. ✅ View dashboard

### **Customer App:**
1. ✅ Search for vendors by category
2. ✅ Filter by service type
3. ✅ View vendor profiles
4. ✅ See ratings (all 0 initially)
5. ✅ Book services

---

## 🚨 CRITICAL NOTES

### **1. All Vendors Start Inactive**
- `isActive: false`
- `setupCompleted: false`
- Even approved vendors must complete setup flow
- This mimics real-world onboarding

### **2. Setup Flow Stages**
- **Pending vendors:** `setupStage: 'not_started'`
- **Approved vendors:** `setupStage: 'services_pending'`
- Vendors must:
  1. Configure services
  2. Set availability
  3. Then become active

### **3. No Services Initially**
- All vendors start with 0 services
- They must add services from the catalog
- This tests the service configuration flow

### **4. Phone Numbers**
- All start with `9876543210` through `9876543236`
- Sequential for easy testing
- Can login with any of these phones in Vendor App

---

## 📞 QUICK TEST LOGINS

Use these phone numbers to test vendor login:

| Phone | Vendor | Role | Status |
|-------|--------|------|--------|
| 9876543210 | Dr. Anita Desai | Veterinarian | ✅ Approved |
| 9876543211 | Dr. Rajesh Kumar | Veterinarian | ✅ Approved |
| 9876543213 | Priya Sharma | Pet Groomer | ✅ Approved |
| 9876543216 | Amit Patel | Pet Trainer | ✅ Approved |
| 9876543219 | Ravi Kumar | Pet Walker | ✅ Approved |
| 9876543212 | Dr. Mohammed Ali | Veterinarian | ⏳ Pending |
| 9876543215 | Sneha Iyer | Pet Groomer | ❌ Rejected |

---

## ✅ SUCCESS CRITERIA

After seeding, you should have:

1. ✅ **27 vendors total** (not 4!)
2. ✅ **9 role types** represented
3. ✅ **3 vendors per role type**
4. ✅ **NO "N/A" values** for serviceCategory or vendorType
5. ✅ **18 approved** + 6 pending + 3 rejected
6. ✅ **All vendors inactive** (must complete setup)
7. ✅ **Mix of service styles** (home/center/both)
8. ✅ **Mix of business types** (individual/small/enterprise)

---

## 🎉 READY FOR UAT!

With 27 comprehensive vendors, you can now:
- Test all vendor workflows
- Test all admin workflows
- Test all customer workflows
- Validate role-based service filtering
- Validate approval workflows
- Validate setup completion flows

**Your UAT is now PROPERLY configured with realistic data!** 🚀
