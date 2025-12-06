# 🎯 Dynamic Role Configuration System - Complete Implementation

## 🌟 Overview

The **Dynamic Role Configuration System** is a revolutionary approach to managing vendor onboarding and operations in the Warmpawz platform. Instead of hard-coded vendor types, **everything is now configurable from Platform Admin**.

### What Makes This Special?

✅ **100% Configurable** - Create/edit roles without touching code  
✅ **Multi-Service Support** - Clinics can be vet + groomer + pharmacy  
✅ **Granular Control** - Control pricing, onboarding fields, documents  
✅ **Staff Management** - Clinics with multiple doctors/staff  
✅ **Dynamic Approval Workflows** - Different approval flows per role  
✅ **Pre-Seeded Data** - All existing vendor types automatically configured  

---

## 📋 Architecture

### 1. **Role Configuration Layer** (Platform Admin)
Platform Admin controls ALL aspects of vendor roles:
- Role definition (name, description, icon)
- Vendor types (Service Provider, Healthcare Provider, Seller)
- Service styles (At Home, At Center, Tele)
- Pricing controls (who can control price/duration)
- Onboarding requirements (fields + documents)
- Approval workflows
- Capabilities (chat, prescription, booking, etc.)

### 2. **Onboarding Layer** (Vendor App)
Vendor App dynamically adapts based on role configuration:
- Forms render based on configured fields
- Documents requested based on role requirements
- Multi-service enabled if configured
- Staff management if enabled
- Approval flow follows role configuration

### 3. **Service Layer** (Customer App)
Customer App shows services based on vendor capabilities:
- Only enabled capabilities shown
- Pricing locked if vendor can't control
- Service styles filtered by role config

---

## 🎭 Pre-Configured Roles

### 1. **Veterinarian** (Healthcare Provider)
```
Icon: 🏥
Vendor Type: Healthcare Provider
Service Styles: At Home, At Center, Tele
Pricing Control: ✅ Price ✅ Duration
Range: ₹200 - ₹5,000

Features:
- Medical consultations
- Vaccinations & treatments
- Surgery & emergency care
- Health certificates
- Prescription management

Onboarding Fields:
Required: businessName, ownerName, phone, email, address, gstNumber, licenseNumber, experience
Custom: Veterinary License Number, Specialization

Documents:
✅ Aadhar Card (front/back)
✅ PAN Card
✅ Veterinary License
✅ Degree Certificate
✅ GST Certificate

Staff Management: ✅ Enabled
Roles: Doctor, Nurse, Assistant
Staff Documents Required: Yes

Multi-Service: ✅ Enabled
Allowed: Grooming, Pharmacy
Separate Approval: Yes

Capabilities:
✅ Booking ✅ Tele ✅ Chat ✅ Prescription ✅ Medical Records

Approval Workflow:
✅ Manual Approval Required
✅ Background Check
✅ License Verification
```

### 2. **Pet Groomer** (Service Provider)
```
Icon: ✂️
Vendor Type: Service Provider
Service Styles: At Home, At Center
Pricing Control: Style-Based
- At Home: ✗ Price ✗ Duration (Platform controlled)
- At Center: ✅ Price ✅ Duration
Range: ₹300 - ₹3,000

Features:
- Bath & dry
- Haircut & styling
- Nail trimming
- Ear cleaning
- Teeth brushing

Onboarding Fields:
Required: businessName, ownerName, phone, email, address, experience
Custom: Grooming Certifications, Years of Experience

Documents:
✅ Aadhar Card (front/back)
✅ PAN Card
✅ Police Verification (required for At Home only)
Shop Photos (optional for At Center)

Staff Management: ✗ Disabled

Multi-Service: ✗ Disabled

Capabilities:
✅ Booking ✅ Gallery

Approval Workflow:
✅ Manual Approval Required
✅ Background Check
```

### 3. **Pet Trainer** (Service Provider)
```
Icon: 🎓
Vendor Type: Service Provider
Service Styles: At Home, At Center
Pricing Control: ✅ Price ✅ Duration
Range: ₹500 - ₹5,000

Features:
- Obedience training
- Behavior correction
- Agility training
- Puppy training
- Advanced training

Custom Fields:
- Training Methods (multiselect)
- Specialization (Dogs/Cats/Birds/All)

Documents:
✅ Aadhar + PAN + Police Verification
Training Certifications (optional)

Capabilities:
✅ Booking ✅ Progress Tracking
```

### 4. **Pet Walker** (Service Provider)
```
Icon: 🚶
Vendor Type: Service Provider
Service Styles: At Home ONLY
Pricing Control: ✗ PLATFORM CONTROLLED
Platform sets all pricing

Features:
- Daily walks
- Exercise sessions
- GPS tracking
- Photo updates
- Multiple pets

Custom Fields:
- Walking Radius (km)
- Max Pets per Walk

Documents:
✅ Aadhar + Police Verification + Photo ID

Capabilities:
✅ Booking ✅ GPS Tracking ✅ Photo Updates

Note: NO pricing/duration control for pet walkers!
```

### 5. **Pet Boarder** (Service Provider)
```
Icon: 🏠
Vendor Type: Service Provider
Service Styles: At Center ONLY
Pricing Control: ✅ Price ✅ Duration
Range: ₹300 - ₹2,000

Features:
- Overnight boarding
- Daycare services
- AC rooms
- Play areas
- CCTV monitoring

Custom Fields:
- Total Capacity
- Facilities (multiselect: AC Rooms, Play Area, CCTV, Vet on Call, Swimming Pool)

Documents:
✅ Aadhar + PAN + GST Certificate
✅ Facility Photos
✅ Business License

Staff Management: ✅ Enabled
Roles: Caretaker, Manager

Capabilities:
✅ Booking ✅ CCTV Access ✅ Photo Updates
```

### 6. **Pet Photographer** (Service Provider)
```
Icon: 📸
Vendor Type: Service Provider
Service Styles: At Home, At Center
Pricing Control: ✅ Price ✅ Duration
Range: ₹1,000 - ₹10,000

Features:
- Studio photography
- Outdoor shoots
- Event coverage
- Digital editing
- Printed albums

Custom Fields:
- Portfolio Link
- Equipment

Documents:
✅ Aadhar + PAN + Portfolio

Capabilities:
✅ Booking ✅ Gallery ✅ Portfolio
```

### 7. **Pet Pharmacy** (Seller)
```
Icon: 💊
Vendor Type: Seller
Service Styles: At Center (Physical Store)
Pricing Control: ✅ Price ✗ Duration
Range: ₹10 - ₹50,000

Features:
- Prescription medicines
- OTC products
- Supplements
- Medical devices
- Home delivery

Custom Fields:
- Drug License Number
- Registered Pharmacist Name
- Delivery Radius

Documents:
✅ Aadhar + PAN + GST Certificate
✅ Drug License (CRITICAL!)
✅ Shop Act License

Staff Management: ✅ Enabled
Roles: Pharmacist, Delivery Person
Staff Documents Required: Yes

Capabilities:
✅ Catalog ✅ Inventory ✅ Orders ✅ Delivery

Approval Workflow:
✅ Manual Approval Required
✅ Background Check
✅ License Verification (Drug License)
```

### 8. **Pet Clinic** (Multi-Service Powerhouse) 🏥
```
Icon: 🏥
Vendor Type: Healthcare Provider + Service Provider + Seller
Service Styles: At Center, At Home, Tele
Pricing Control: ✅ Price ✅ Duration
Range: ₹200 - ₹50,000

Features:
- Veterinary services
- Grooming facility
- In-house pharmacy
- Surgery unit
- Emergency care

THIS IS THE BIG ONE! Clinics can offer:
✅ Veterinary care (consultations, surgery)
✅ Grooming services
✅ Medicine sales (pharmacy)
✅ Boarding (optional)

Custom Fields:
- Clinic License Number
- Services Offered (multiselect)
- Operating Hours

Documents:
✅ Aadhar + PAN + GST Certificate
✅ Clinic License
✅ Drug License (if pharmacy enabled)
✅ Facility Photos

Staff Management: ✅ FULL STAFF SUPPORT
Roles: Doctor, Nurse, Groomer, Pharmacist, Receptionist
Staff Documents Required: Yes

Multi-Service: ✅ ENABLED
Allowed: Veterinary, Grooming, Pharmacy, Boarding
Separate Approval: Yes (each service needs approval)

Capabilities:
✅ Booking ✅ Tele ✅ Chat ✅ Prescription
✅ Catalog ✅ Inventory ✅ Medical Records ✅ Emergency

Approval Workflow:
✅ Manual Approval Required
✅ Background Check
✅ License Verification
```

---

## 🛠️ API Endpoints

### Get All Roles
```http
GET /config/roles
```

**Response:**
```json
{
  "roles": [
    {
      "id": "veterinarian",
      "name": "Veterinarian",
      "description": "Licensed veterinary doctors...",
      "vendorTypes": ["healthcare_provider"],
      "serviceStyles": ["at_home", "at_center", "tele"],
      "pricingControl": {
        "canControlPrice": true,
        "canControlDuration": true
      },
      "capabilities": ["booking", "tele", "chat", "prescription"],
      "staffManagement": {
        "enabled": true,
        "roles": ["doctor", "nurse"]
      }
    }
  ]
}
```

### Create Role
```http
POST /config/roles
```

**Body:**
```json
{
  "name": "Pet Spa",
  "description": "Luxury pet spa services",
  "vendorTypes": ["service_provider"],
  "serviceStyles": ["at_center"],
  "pricingControl": {
    "canControlPrice": true,
    "canControlDuration": true,
    "priceRangeMin": 500,
    "priceRangeMax": 5000
  },
  "onboardingFields": {
    "required": ["businessName", "phone", "email"],
    "custom": [
      {
        "id": "spaTreatments",
        "label": "Spa Treatments Offered",
        "type": "multiselect",
        "options": ["Massage", "Aromatherapy", "Hydrotherapy"]
      }
    ]
  },
  "documentRequirements": [
    { "id": "aadhar", "name": "Aadhar Card", "required": true }
  ],
  "capabilities": ["booking", "gallery"],
  "approvalWorkflow": {
    "requiresManualApproval": true,
    "requiresBackgroundCheck": true
  }
}
```

### Update Role
```http
PUT /config/roles/:roleId
```

### Delete Role
```http
DELETE /config/roles/:roleId
```

### Seed Initial Roles
```http
POST /config/roles/seed
```

This creates ALL 8 pre-configured roles automatically!

---

## 💻 Platform Admin UI

### Location
**Catalog & Services → Roles Tab**

### Features

1. **Role Cards Grid**
   - Visual display of all roles
   - Icon, name, description
   - Vendor types badges
   - Service styles badges
   - Pricing control indicators
   - Capabilities icons
   - Special features (Staff, Multi-Service, License)

2. **Seed Button**
   - One-click to pre-configure all 8 roles
   - Only shows when no roles exist

3. **Create/Edit Dialog**
   - **Basic Tab**: Name, description, icon, order
   - **Types & Styles Tab**: Vendor types, service styles, capabilities
   - **Pricing Tab**: Price/duration control, range limits
   - **Onboarding Tab**: Staff management, multi-service toggles
   - **Workflow Tab**: Approval requirements

4. **Actions**
   - Edit role
   - Delete role (with safety check)
   - View onboarding config

---

## 🔄 Integration with Vendor App

### How It Works

1. **Vendor Selects Role** (Vendor Role Selection screen)
   ```tsx
   // Vendor app fetches roles from API
   GET /config/roles
   
   // Shows role cards dynamically
   // Vendor clicks a role → stores roleId
   ```

2. **Onboarding Form Adapts**
   ```tsx
   // Fetch onboarding config for selected role
   GET /config/roles/:roleId/onboarding
   
   // Render fields based on config
   config.fields.required → mandatory inputs
   config.fields.custom → dynamic fields
   config.documents → file uploads
   ```

3. **Approval Flow Follows Config**
   ```tsx
   // After submission
   if (role.approvalWorkflow.requiresManualApproval) {
     status = 'pending_approval'
     // Admin must review
   } else {
     status = 'approved'
     // Auto-approved
   }
   ```

4. **Service Setup**
   ```tsx
   // Only show if vendor can control pricing
   if (role.pricingControl.canControlPrice) {
     showPricingInputs()
   }
   
   // Filter service styles
   availableStyles = role.serviceStyles
   ```

### Database Schema

**Role Configuration:**
```
role:config:veterinarian
role:config:pet_groomer
role:config:pet_trainer
role:config:pet_walker
role:config:pet_boarder
role:config:pet_photographer
role:config:pet_pharmacy
role:config:pet_clinic
```

**Vendor Record:**
```json
{
  "id": "vendor_xxxxx",
  "role": "veterinarian",
  "vendorTypes": ["healthcare_provider"],
  "serviceStyles": ["at_home", "at_center", "tele"],
  "pricingControlled": true,
  "multiServiceEnabled": true,
  "enabledServices": ["veterinary", "grooming"],
  "staffMembers": [
    {
      "id": "staff_1",
      "name": "Dr. John",
      "role": "doctor",
      "license": "VET12345"
    }
  ]
}
```

---

## 🎨 UI/UX Highlights

### Role Cards
```
┌─────────────────────────┐
│ 🏥 Veterinarian         │
│ veterinarian     [Active]│
│                          │
│ Licensed veterinary...   │
│                          │
│ VENDOR TYPES             │
│ [Healthcare Provider]    │
│                          │
│ SERVICE STYLES           │
│ [At Home][At Center][Tele]│
│                          │
│ PRICING CONTROL          │
│ [✓ Price][✓ Duration]   │
│                          │
│ CAPABILITIES             │
│ 📅 💬 📋 🏥 📞          │
│                          │
│ [👥 Staff][⚡ Multi]     │
│ [🛡️ License]            │
│                          │
│ [Edit]  [Delete]         │
└─────────────────────────┘
```

### Create/Edit Modal
- **Tabbed Interface** for organization
- **Smart Validation** - vendor types required
- **Live Preview** - see changes immediately
- **Help Text** - guidance for each field

---

## 🚀 Migration Path

### Current Vendor Types → New Roles

All existing vendors automatically mapped:

| Old Type | New Role | Auto-Migrated |
|----------|----------|---------------|
| Groomer | pet_groomer | ✅ |
| Veterinarian | veterinarian | ✅ |
| Trainer | pet_trainer | ✅ |
| Walker | pet_walker | ✅ |
| Boarder | pet_boarder | ✅ |
| Photographer | pet_photographer | ✅ |

New vendors use role-based onboarding!

---

## 🎯 Key Use Cases

### Use Case 1: Create New "Pet Spa" Role
```
1. Admin → Catalog & Services → Roles
2. Click "Create Role"
3. Fill in:
   - Name: Pet Spa
   - Type: Service Provider
   - Styles: At Center
   - Pricing: Can control both
   - Capabilities: booking, gallery
4. Save
5. Immediately available in Vendor App!
```

### Use Case 2: Clinic with Pharmacy
```
1. Vendor selects "Pet Clinic" role
2. Onboarding form shows:
   - All healthcare fields
   - Drug license upload (required)
   - Multi-service selection
3. Vendor checks: Veterinary + Pharmacy
4. Submits application
5. Admin approves veterinary first
6. Pharmacy requires separate drug license verification
7. Both approved → Full clinic operational
```

### Use Case 3: Modify Pricing for Pet Walkers
```
1. Admin wants to give walkers pricing control
2. Edit "pet_walker" role
3. Toggle "Can Control Price" → ON
4. Set range: ₹100 - ₹300
5. Save
6. All existing + new pet walkers can now set prices!
```

---

## 📊 Statistics

| Metric | Count |
|--------|-------|
| **Total Endpoints** | 6 |
| **Pre-Configured Roles** | 8 |
| **Vendor Types** | 3 |
| **Service Styles** | 3 |
| **Capabilities** | 16 |
| **Document Types** | 10+ |

---

## ✨ Future Enhancements

### Phase 2:
- **Custom Field Builder** - Drag & drop form builder
- **Conditional Logic** - "If X, then require Y"
- **Multi-Language** - Role names in multiple languages
- **Role Templates** - Quick-start templates
- **Bulk Import** - CSV upload for roles

### Phase 3:
- **Role Versioning** - Track changes over time
- **A/B Testing** - Test different onboarding flows
- **Analytics** - Which roles convert best
- **Smart Recommendations** - Suggest roles to vendors
- **Third-Party Integrations** - Sync with external systems

---

## 🎉 Summary

This system transforms Warmpawz from a **static platform** to a **dynamic ecosystem** where:

✅ **Admin has FULL control** - No code changes needed  
✅ **Vendors get tailored experience** - Perfect onboarding for each role  
✅ **Customers see relevant services** - Only what vendors can actually provide  
✅ **Scalable** - Add 100 new roles without touching code  
✅ **Future-proof** - Ready for any business model change  

### The Magic Formula:
```
Platform Admin Config → API → Vendor App → Customer Experience
           ↓
     Everything Dynamic!
```

**This is the foundation for a truly configurable, enterprise-grade pet services platform! 🐾**
