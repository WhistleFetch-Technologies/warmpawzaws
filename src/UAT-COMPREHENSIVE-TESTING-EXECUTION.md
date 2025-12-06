# 🧪 COMPREHENSIVE UAT LIFECYCLE TESTING - EXECUTION LOG

**Objective:** End-to-end testing with real UAT onboarding, dynamic configuration, and lifecycle verification

**Date:** In Progress  
**Tester:** AI Assistant  
**Scope:** Complete vendor lifecycle from onboarding to customer visibility

---

## 📋 TESTING PHASES

### Phase 1: Cleanup ✅ IN PROGRESS
- [ ] Delete all existing vendors
- [ ] Verify vendor count = 0

### Phase 2: Role Configuration Review
- [ ] Check all configured roles
- [ ] Review service styles allowed per role
- [ ] Review custom service eligibility

### Phase 3: Vendor Creation (3 per role, UAT style)
- [ ] Create vendors via onboarding UI (not backend)
- [ ] Submit applications
- [ ] Complete profile setup

### Phase 4: Admin Approval
- [ ] Review pending applications
- [ ] Approve all vendors
- [ ] Verify approval notifications

### Phase 5: Service Configuration (Platform Admin)
- [ ] Enable services from catalog for each vendor
- [ ] Different service counts per vendor type
- [ ] Create custom services (where allowed)

### Phase 6: Service Publishing
- [ ] Vendors publish services
- [ ] Services visible in customer app

### Phase 7: Dynamic Configuration Testing
- [ ] Change service styles from platform admin
- [ ] Verify dynamic update in vendor dashboard
- [ ] Test service enablement for updated styles

---

## 🗑️ STEP 1: CLEANUP - DELETE ALL VENDORS

### Pre-Cleanup Vendor Count:
**API Call:** `GET /admin/vendors/count`

**Expected:** Unknown (checking...)

### Cleanup Execution:
**API Call:** `DELETE /admin/cleanup/vendors`

**Result:** Pending execution...

### Post-Cleanup Verification:
**API Call:** `GET /admin/vendors/count`

**Expected:** 0 vendors

**Status:** 🟡 PENDING

---

## 🔍 STEP 2: ROLE CONFIGURATION REVIEW

### Configured Roles (from platform admin):

**To be retrieved from:** `GET /admin/roles/list`

**Expected Roles:**
1. Veterinarian
2. Pet Groomer
3. Pet Walker
4. Pet Trainer
5. Pet Boarding
6. Pet Sitter
7. Pet Daycare
8. Pet Photographer
9. (Others as configured)

**Service Styles Configuration:**

| Role | at_home | at_center | tele | both | Custom Services Allowed? |
|------|---------|-----------|------|------|-------------------------|
| TBD | TBD | TBD | TBD | TBD | TBD |

**Status:** 🟡 PENDING

---

## 👥 STEP 3: VENDOR CREATION PLAN

### Total Vendors to Create: 3 per role

**Onboarding Method:** ✅ UAT-style (through UI/API endpoints, NOT direct database seeding)

**Vendor Details:**

---

### ROLE 1: VETERINARIAN (assuming 3 service styles configured)

#### Vendor 1.1: Dr. Sarah Kumar - Mobile Vet (at_home)
- **Name:** Dr. Sarah Kumar
- **Business:** Mobile Vet Care
- **Service Style:** at_home
- **Phone:** +91-9876543210
- **Email:** sarah.kumar@mobilevet.com
- **License:** VET-MH-2024-001
- **Experience:** 8 years
- **Qualifications:** BVSc, MVSc
- **Services to Enable:**
  - Emergency home visit
  - Vaccination at home
  - Health checkup at home
  - Minor wound treatment at home
  - Post-surgery care at home
- **Service Count:** 5 services
- **Custom Services:** N/A (at_home not allowed)

#### Vendor 1.2: Dr. Amit Patel - Healthy Paws Clinic (at_center)
- **Name:** Dr. Amit Patel
- **Business:** Healthy Paws Veterinary Clinic
- **Service Style:** at_center
- **Phone:** +91-9876543211
- **Email:** amit.patel@healthypaws.com
- **License:** VET-DL-2024-002
- **Experience:** 12 years
- **Qualifications:** BVSc, MVSc, PhD
- **Clinic Address:** 123 MG Road, New Delhi
- **Services to Enable:**
  - Comprehensive health examination
  - Surgical procedures
  - Dental care
  - X-ray and diagnostics
  - Vaccination
  - Deworming
  - Blood tests
  - Emergency treatment
- **Service Count:** 8 services from catalog
- **Custom Services to Create:**
  1. **Premium Annual Health Package**
     - Type: Package
     - Duration: 90 days
     - Sessions: 3 checkups
     - Pricing: Small: ₹3000, Medium: ₹4500, Large: ₹6000, XL: ₹8000
     - Includes: Complete blood work, X-ray, dental checkup
  2. **Senior Pet Care Program**
     - Type: Single service
     - Duration: 120 minutes
     - Price: ₹2500
     - Includes: Geriatric screening, joint assessment, diet consultation
- **Custom Service Count:** 2 services

#### Vendor 1.3: Dr. Priya Sharma - VetConnect Online (tele)
- **Name:** Dr. Priya Sharma
- **Business:** VetConnect Tele Consultations
- **Service Style:** tele
- **Phone:** +91-9876543212
- **Email:** priya.sharma@vetconnect.com
- **License:** VET-KA-2024-003
- **Experience:** 6 years
- **Qualifications:** BVSc, MVSc
- **Services to Enable:**
  - General health consultation
  - Diet and nutrition advice
  - Behavioral consultation
  - Medication guidance
  - Post-treatment follow-up
- **Service Count:** 5 services
- **Custom Services:** N/A (tele not allowed)

---

### ROLE 2: PET GROOMER (assuming at_home, at_center configured)

#### Vendor 2.1: Ravi Mehta - Pampered Paws Mobile (at_home)
- **Name:** Ravi Mehta
- **Business:** Pampered Paws Mobile Grooming
- **Service Style:** at_home
- **Phone:** +91-9876543213
- **Email:** ravi.mehta@pamperedpaws.com
- **Experience:** 5 years
- **Certification:** Professional Grooming Certificate
- **Services to Enable:**
  - Complete grooming at home
  - Bath and brush at home
  - Nail trimming at home
  - De-shedding treatment at home
- **Service Count:** 4 services
- **Custom Services:** N/A (at_home not allowed)

#### Vendor 2.2: Anjali Desai - Glam Pets Salon (at_center)
- **Name:** Anjali Desai
- **Business:** Glam Pets Grooming Salon
- **Service Style:** at_center
- **Phone:** +91-9876543214
- **Email:** anjali.desai@glampets.com
- **Experience:** 10 years
- **Certification:** Master Groomer Certification
- **Salon Address:** 456 Park Street, Mumbai
- **Services to Enable:**
  - Premium salon grooming
  - Spa treatment
  - Breed-specific grooming
  - Show dog grooming
  - De-matting service
  - Teeth cleaning
- **Service Count:** 6 services from catalog
- **Custom Services to Create:**
  1. **Luxury Spa Package (7-day)**
     - Type: Package
     - Duration: 7 days, 1 session/day, 90 mins each
     - Pricing: Small: ₹5000, Medium: ₹7000, Large: ₹9000, XL: ₹12000
     - Includes: Daily massage, aromatherapy, coat treatment
  2. **Show Champion Preparation**
     - Type: Single service
     - Duration: 180 minutes
     - Price: ₹4500
     - Includes: Complete styling, coat enhancement, nail art
- **Custom Service Count:** 2 services

#### Vendor 2.3: Karthik Nair - PawSpa (both - hybrid)
- **Name:** Karthik Nair
- **Business:** PawSpa Grooming Services
- **Service Style:** both (at_home + at_center)
- **Phone:** +91-9876543215
- **Email:** karthik.nair@pawspa.com
- **Experience:** 7 years
- **Certification:** Advanced Grooming Certification
- **Salon Address:** 789 Brigade Road, Bangalore
- **Services to Enable (at_home):**
  - Complete grooming at home
  - Bath and brush at home
  - Nail trimming at home
- **Services to Enable (at_center):**
  - Premium salon grooming
  - Spa treatment
  - Breed-specific grooming
  - De-matting service
- **Service Count:** 3 at_home + 4 at_center = 7 services
- **Custom Services to Create (at_center only):**
  1. **Weekend Pampering Package**
     - Type: Package
     - Duration: 2 days, 2 sessions/day, 60 mins each
     - Pricing: Small: ₹2000, Medium: ₹3000, Large: ₹4000, XL: ₹5000
- **Custom Service Count:** 1 service

---

### ROLE 3: PET WALKER (assuming at_home only)

#### Vendor 3.1: Rohan Singh - FitPaws Walking
- **Name:** Rohan Singh
- **Business:** FitPaws Professional Dog Walking
- **Service Style:** at_home
- **Phone:** +91-9876543216
- **Email:** rohan.singh@fitpaws.com
- **Experience:** 3 years
- **Services to Enable:**
  - Daily dog walking (30 min)
  - Daily dog walking (60 min)
  - Group walking session
  - Weekend adventure walk
- **Service Count:** 4 services
- **Custom Services:** N/A (at_home not allowed)

#### Vendor 3.2: Neha Kapoor - WalkWag Services
- **Name:** Neha Kapoor
- **Business:** WalkWag Dog Walking Services
- **Service Style:** at_home
- **Phone:** +91-9876543217
- **Email:** neha.kapoor@walkwag.com
- **Experience:** 4 years
- **Services to Enable:**
  - Daily dog walking (30 min)
  - Daily dog walking (60 min)
  - Puppy walking session
  - Senior dog walk (gentle)
- **Service Count:** 4 services
- **Custom Services:** N/A (at_home not allowed)

#### Vendor 3.3: Arjun Reddy - PawSteps Walking
- **Name:** Arjun Reddy
- **Business:** PawSteps Professional Walking
- **Service Style:** at_home
- **Phone:** +91-9876543218
- **Email:** arjun.reddy@pawsteps.com
- **Experience:** 5 years
- **Services to Enable:**
  - Daily dog walking (30 min)
  - Daily dog walking (60 min)
  - Group walking session
  - Jogging with your dog
- **Service Count:** 4 services
- **Custom Services:** N/A (at_home not allowed)

---

### ROLE 4: PET TRAINER (assuming at_home, at_center)

#### Vendor 4.1: Vikram Joshi - Home Training Pro (at_home)
- **Name:** Vikram Joshi
- **Business:** Home Training Pro
- **Service Style:** at_home
- **Phone:** +91-9876543219
- **Email:** vikram.joshi@hometrainingpro.com
- **Experience:** 9 years
- **Certification:** Certified Dog Trainer
- **Services to Enable:**
  - Basic obedience training at home
  - Puppy training at home
  - Behavioral correction at home
  - Potty training at home
  - Socialization training at home
- **Service Count:** 5 services
- **Custom Services:** N/A (at_home not allowed)

#### Vendor 4.2: Meera Iyer - Alpha Training Academy (at_center)
- **Name:** Meera Iyer
- **Business:** Alpha Dog Training Academy
- **Service Style:** at_center
- **Phone:** +91-9876543220
- **Email:** meera.iyer@alphatraining.com
- **Experience:** 15 years
- **Certification:** Master Trainer Certification
- **Academy Address:** 321 Training Lane, Chennai
- **Services to Enable:**
  - Basic obedience course
  - Advanced training program
  - Agility training
  - Guard dog training
  - Competition preparation
  - Behavioral assessment
- **Service Count:** 6 services from catalog
- **Custom Services to Create:**
  1. **Elite K9 Training Program (30-day)**
     - Type: Package
     - Duration: 30 days, 2 sessions/day, 90 mins each
     - Pricing: Small: ₹25000, Medium: ₹30000, Large: ₹35000, XL: ₹40000
     - Includes: Complete obedience, protection, agility
  2. **Puppy Foundation Course**
     - Type: Single service
     - Duration: 120 minutes
     - Price: ₹3500
     - Includes: Socialization, basic commands, crate training
- **Custom Service Count:** 2 services

#### Vendor 4.3: Suresh Kumar - K9 Excellence (both)
- **Name:** Suresh Kumar
- **Business:** K9 Excellence Training
- **Service Style:** both
- **Phone:** +91-9876543221
- **Email:** suresh.kumar@k9excellence.com
- **Experience:** 12 years
- **Certification:** Professional Dog Trainer
- **Academy Address:** 654 Training Road, Pune
- **Services to Enable (at_home):**
  - Basic obedience training at home
  - Puppy training at home
  - Behavioral correction at home
- **Services to Enable (at_center):**
  - Advanced training program
  - Agility training
  - Guard dog training
  - Competition preparation
- **Service Count:** 3 at_home + 4 at_center = 7 services
- **Custom Services to Create (at_center only):**
  1. **Weekend Warrior Package**
     - Type: Package
     - Duration: 2 days, 3 sessions/day, 60 mins each
     - Pricing: Small: ₹5000, Medium: ₹6000, Large: ₹7000, XL: ₹8000
- **Custom Service Count:** 1 service

---

### ROLE 5: PET BOARDING (assuming at_center only)

#### Vendor 5.1: Lakshmi Nair - Cozy Paws Boarding
- **Name:** Lakshmi Nair
- **Business:** Cozy Paws Pet Boarding
- **Service Style:** at_center
- **Phone:** +91-9876543222
- **Email:** lakshmi.nair@cozypaws.com
- **Experience:** 8 years
- **Facility License:** BOARD-TN-2024-001
- **Facility Address:** 987 Boarding Avenue, Coimbatore
- **Services to Enable:**
  - Standard boarding (per day)
  - Premium boarding (per day)
  - Luxury suite boarding (per day)
  - Weekend boarding package
  - Extended stay (7 days)
  - Extended stay (15 days)
  - Extended stay (30 days)
- **Service Count:** 7 services from catalog
- **Custom Services to Create:**
  1. **VIP Long-term Boarding (60 days)**
     - Type: Package
     - Duration: 60 days
     - Pricing: Small: ₹45000, Medium: ₹60000, Large: ₹75000, XL: ₹90000
     - Includes: Daily grooming, playtime, medical checkups
  2. **Holiday Special Care**
     - Type: Single service
     - Duration: 1 day
     - Price: ₹2500
     - Includes: Extra playtime, special treats, photo updates
- **Custom Service Count:** 2 services

#### Vendor 5.2: Rajesh Gupta - Happy Tails Boarding
- **Name:** Rajesh Gupta
- **Business:** Happy Tails Pet Hotel
- **Service Style:** at_center
- **Phone:** +91-9876543223
- **Email:** rajesh.gupta@happytails.com
- **Experience:** 10 years
- **Facility License:** BOARD-UP-2024-002
- **Facility Address:** 456 Pet Lane, Lucknow
- **Services to Enable:**
  - Standard boarding (per day)
  - Premium boarding (per day)
  - Luxury suite boarding (per day)
  - Weekend boarding package
  - Extended stay (7 days)
  - Daycare service
- **Service Count:** 6 services from catalog
- **Custom Services to Create:**
  1. **Puppy Daycare + Training Combo**
     - Type: Package
     - Duration: 30 days, 1 session/day, 240 mins each
     - Pricing: Small: ₹15000, Medium: ₹18000, Large: ₹20000, XL: ₹22000
- **Custom Service Count:** 1 service

#### Vendor 5.3: Divya Menon - Pawsitive Boarding
- **Name:** Divya Menon
- **Business:** Pawsitive Pet Boarding & Daycare
- **Service Style:** at_center
- **Phone:** +91-9876543224
- **Email:** divya.menon@pawsitive.com
- **Experience:** 6 years
- **Facility License:** BOARD-KL-2024-003
- **Facility Address:** 789 Care Street, Kochi
- **Services to Enable:**
  - Standard boarding (per day)
  - Premium boarding (per day)
  - Luxury suite boarding (per day)
  - Extended stay (7 days)
  - Extended stay (15 days)
  - Daycare service
  - Overnight care
- **Service Count:** 7 services from catalog
- **Custom Services to Create:**
  1. **Weekend Getaway Package**
     - Type: Package
     - Duration: 2 days
     - Pricing: Small: ₹3000, Medium: ₹4000, Large: ₹5000, XL: ₹6000
  2. **Medical Recovery Boarding**
     - Type: Single service
     - Duration: 1 day
     - Price: ₹3500
     - Includes: Post-surgery care, medication administration, monitoring
- **Custom Service Count:** 2 services

---

## 📊 VENDOR CREATION SUMMARY

### Total Vendors: 15 vendors (3 per role, 5 roles)

### Breakdown by Service Style:

| Service Style | Count | Percentage |
|--------------|-------|------------|
| at_home | 6 vendors | 40% |
| at_center | 7 vendors | 47% |
| both | 2 vendors | 13% |
| tele | 1 vendor | 7% (note: will add more if roles configured) |

### Services Configuration Summary:

| Vendor | Role | Style | Catalog Services | Custom Services | Total Services |
|--------|------|-------|-----------------|-----------------|----------------|
| Dr. Sarah Kumar | Vet | at_home | 5 | 0 | 5 |
| Dr. Amit Patel | Vet | at_center | 8 | 2 | 10 |
| Dr. Priya Sharma | Vet | tele | 5 | 0 | 5 |
| Ravi Mehta | Groomer | at_home | 4 | 0 | 4 |
| Anjali Desai | Groomer | at_center | 6 | 2 | 8 |
| Karthik Nair | Groomer | both | 7 | 1 | 8 |
| Rohan Singh | Walker | at_home | 4 | 0 | 4 |
| Neha Kapoor | Walker | at_home | 4 | 0 | 4 |
| Arjun Reddy | Walker | at_home | 4 | 0 | 4 |
| Vikram Joshi | Trainer | at_home | 5 | 0 | 5 |
| Meera Iyer | Trainer | at_center | 6 | 2 | 8 |
| Suresh Kumar | Trainer | both | 7 | 1 | 8 |
| Lakshmi Nair | Boarding | at_center | 7 | 2 | 9 |
| Rajesh Gupta | Boarding | at_center | 6 | 1 | 7 |
| Divya Menon | Boarding | at_center | 7 | 2 | 9 |

### Custom Services Summary:

**Total Custom Services:** 15 custom services

**By Vendor:**
- Dr. Amit Patel (Vet, at_center): 2 custom services
- Anjali Desai (Groomer, at_center): 2 custom services
- Karthik Nair (Groomer, both): 1 custom service
- Meera Iyer (Trainer, at_center): 2 custom services
- Suresh Kumar (Trainer, both): 1 custom service
- Lakshmi Nair (Boarding, at_center): 2 custom services
- Rajesh Gupta (Boarding, at_center): 1 custom service
- Divya Menon (Boarding, at_center): 2 custom services

**Custom Service Types:**
- Single services: 6
- Package services: 9

---

## ⚙️ STEP 4: EXECUTION PLAN

### 4.1 Cleanup
1. Call `DELETE /admin/cleanup/vendors`
2. Verify count = 0

### 4.2 Vendor Onboarding (15 vendors)
For each vendor:
1. Call `POST /vendor/register` with vendor details
2. Submit application
3. Upload documents if required
4. Verify status: "pending_approval"

### 4.3 Admin Approval
1. Call `GET /admin/vendors/pending`
2. For each vendor, call `POST /admin/vendors/{id}/approve`
3. Verify status changes to "approved"

### 4.4 Service Configuration
For each vendor:
1. Call `GET /vendor/{id}/services/{serviceStyle}` to get catalog
2. Enable selected services via `POST /vendor/{id}/services/enable`
3. For at_center/both vendors, create custom services via `POST /vendor/{id}/custom-services`
4. Submit custom services for approval via `POST /vendor/{id}/custom-services/{id}/publish`

### 4.5 Custom Service Approval
1. Call `GET /admin/custom-services/pending`
2. For each custom service, call `POST /admin/custom-services/{id}/approve`
3. Verify status: "published"

### 4.6 Customer App Verification
1. Call `GET /search/services` with various filters
2. Verify all services visible
3. Verify custom services appear alongside catalog services

### 4.7 Dynamic Configuration Testing
1. Change service style for a role in platform admin
2. Verify vendor dashboard updates dynamically
3. Enable services for new style
4. Verify services appear in customer app

---

## 🎯 SUCCESS CRITERIA

- ✅ All 15 vendors created via UAT onboarding (not backend seeding)
- ✅ All vendors approved by admin
- ✅ All catalog services enabled as per plan
- ✅ All 15 custom services created and approved
- ✅ All services visible in customer app
- ✅ Dynamic service style change works
- ✅ No hardcoded data, everything from platform admin configuration
- ✅ Complete audit trail of all actions

---

**Status:** 🟡 READY TO EXECUTE

**Next Step:** Execute cleanup and begin vendor creation

---

**AWAITING USER CONFIRMATION TO PROCEED WITH EXECUTION**
