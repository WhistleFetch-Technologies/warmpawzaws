# VENDOR SIGNUP TO DASHBOARD - COMPLETE FLOW ANALYSIS

**Date:** January 2026  
**Scope:** Complete vendor onboarding flow, role definitions, dashboard loading, and wireframe gaps

---

## 📋 EXECUTIVE SUMMARY

This document provides a comprehensive analysis of the vendor signup-to-dashboard flow, covering:
- **Complete flow** from initial signup to dashboard access
- **20 vendor roles** and their definitions
- **Validation checks** at each stage
- **Dynamic dashboard loading** based on role capabilities
- **Missing pieces** in wireframe implementation

---

## 🔄 COMPLETE FLOW: VENDOR SIGNUP TO DASHBOARD

### **PHASE 1: INITIAL AUTHENTICATION (Entry Point)**

#### Step 1: Vendor App Entry → Mobile Number
**Location:** `apps/vendor-web/app/onboarding/page.tsx` → `VendorOnboardingFlow.tsx`  
**Component:** `VendorOnboardingFlow` (step: 'phone')

**Process:**
1. User opens vendor app/web
2. Enters mobile number
3. System checks if vendor identity exists in `vendor_identity` table

**API Endpoint:** `POST /vendor/send-otp`  
**Database Check:**
- Query `vendor_identity` table by phone
- If not exists, create new record with `onboarding_status = 'INIT'`
- If exists, return current `onboarding_status`

**Status After:** `INIT` (if new) or existing status

---

#### Step 2: OTP Verification
**Location:** `VendorOnboardingFlow.tsx` (step: 'otp')

**Process:**
1. System sends OTP (UAT mode: hardcoded '123456')
2. User enters OTP
3. System verifies OTP

**API Endpoints:**
- `POST /vendor/send-otp` - Send OTP
- `POST /vendor/verify-otp` - Verify OTP

**Database Check:**
- Verify OTP against stored value
- Update `vendor_identity.last_activity_at`
- Create/update session token

**Status After:** Same as before (no status change on OTP verification)

---

### **PHASE 2: ROLE SELECTION (Dynamic Loading)**

#### Step 3: Load Available Roles
**Location:** `VendorOnboardingFlow.tsx` (step: 'role')  
**Component:** `VendorRoleSelection.tsx`

**Process:**
1. System fetches all active roles from database
2. Roles are filtered by `is_active = true`
3. Each role includes:
   - Role ID, name, display_name, description
   - Capabilities (from `role_permissions` table)
   - Supported vendor types (`solo` or `business`)
   - Service styles (`at_center`, `at_home`, `tele`)

**API Endpoint:** `GET /vendor/onboarding/roles`  
**Handler:** `GetAvailableRolesHandler` in `backend/lambda/src/endpoints/vendor-onboarding.ts`

**Database Queries:**
```sql
-- Get all active roles
SELECT * FROM roles WHERE is_active = true;

-- Get permissions for each role
SELECT * FROM role_permissions WHERE role_id = ?
```

**Fallback:** If no roles in DB, uses `DEFAULT_ROLES` from `VendorRoleSelection.tsx` (UAT mode)

**Status Check:**
- Must be in `INIT` or `ROLE_PENDING` or `REJECTED` status
- Route guard: `/onboarding/role-selection` only allows these statuses

---

#### Step 4: Select Role
**Process:**
1. User selects a role from the list
2. System validates role exists and is active
3. Updates `vendor_identity.selected_role_id`
4. Transitions status to `ROLE_PENDING`

**API Endpoint:** `POST /vendor/onboarding/select-role`  
**Handler:** `SelectRoleHandler`

**Database Updates:**
```sql
-- Update vendor identity
UPDATE vendor_identity 
SET selected_role_id = ?, updated_at = NOW()
WHERE phone = ?;

-- Transition status (if currently INIT)
SELECT transition_onboarding_status(?, 'ROLE_PENDING', ...)
```

**Validation Checks:**
- ✅ Role exists in `roles` table
- ✅ Role is active (`is_active = true`)
- ✅ Current status allows role selection (`INIT`, `REJECTED`)

**Status After:** `ROLE_PENDING`

**State Machine Transition:**
- `INIT` → `ROLE_PENDING` (via `transition_onboarding_status` function)
- Creates audit trail in `vendor_onboarding_transitions` table

---

### **PHASE 3: VENDOR TYPE SELECTION**

#### Step 5: Choose Solo or Business
**Location:** `VendorOnboardingFlow.tsx` (step: 'business_type')  
**Component:** `BusinessTypeSelector.tsx`

**Process:**
1. System loads supported vendor types for selected role
2. User selects `solo` or `business`
3. System validates selection against role configuration

**API Endpoint:** `POST /vendor/onboarding/select-vendor-type`  
**Handler:** `SelectVendorTypeHandler`

**Database Checks:**
```sql
-- Get role config
SELECT config FROM roles WHERE id = ?;

-- Validate vendor_type is in role.config.vendorTypes
-- Example: ["solo_provider", "center"] or ["solo", "business"]
```

**Validation Checks:**
- ✅ Role must be selected first (`selected_role_id` not null)
- ✅ Vendor type must be `solo` or `business`
- ✅ Vendor type must be supported by role (`role.config.vendorTypes`)

**Status After:** `FORM_PENDING`

**State Machine Transition:**
- `ROLE_PENDING` → `FORM_PENDING`

---

### **PHASE 4: DYNAMIC FORM LOADING**

#### Step 6: Load Dynamic Onboarding Form
**Location:** `VendorOnboardingFlow.tsx` (step: 'form')  
**Component:** Dynamic form based on role + vendor type

**Process:**
1. System fetches form schema for role + vendor type combination
2. Form schema is loaded from `roles.config.onboardingFields`
3. Form fields are dynamically rendered based on schema

**API Endpoint:** `GET /vendor/onboarding/form-schema?phone=...`  
**Handler:** `GetOnboardingFormSchemaHandler`

**Database Function:**
```sql
-- Get form schema
SELECT get_onboarding_form_schema(role_id, vendor_type) as schema;
```

**Form Schema Structure:**
```json
{
  "version": 1,
  "sections": [
    {"id": "basic", "name": "Basic Information", "order": 1},
    {"id": "professional", "name": "Professional Details", "order": 2},
    {"id": "documents", "name": "Documents", "order": 3},
    {"id": "location", "name": "Location & Service Area", "order": 4},
    {"id": "banking", "name": "Banking Details", "order": 5}
  ],
  "fields": [
    {"id": "businessName", "label": "Business Name", "type": "text", "required": true, "section": "basic"},
    {"id": "ownerName", "label": "Owner Name", "type": "text", "required": true, "section": "basic"},
    ...
  ]
}
```

**Validation Checks:**
- ✅ Role and vendor type must be selected
- ✅ Form schema exists for role + vendor type combination
- ✅ Existing application can be edited if status is `DRAFT` or `CLARIFICATION_REQUIRED`

**Status Check:**
- Must be in `FORM_PENDING` or `CLARIFICATION_REQUIRED` status
- Route guard: `/onboarding/form` only allows these statuses

---

#### Step 7: Submit Application
**Process:**
1. User fills dynamic form
2. Uploads required documents
3. Submits application

**API Endpoint:** `POST /vendor/onboarding/submit-application`  
**Handler:** `SubmitApplicationHandler`

**Database Operations:**
```sql
-- Create or update application
INSERT INTO vendor_onboarding_applications (
  vendor_identity_id, role_id, vendor_type,
  application_payload, uploaded_documents,
  status, submitted_at, is_locked
) VALUES (...);

-- Link application to identity
UPDATE vendor_identity SET application_id = ? WHERE id = ?;

-- Transition to UNDER_REVIEW
SELECT transition_onboarding_status(?, 'UNDER_REVIEW', ...)
```

**Validation Checks:**
- ✅ All required fields filled
- ✅ Documents uploaded (if required)
- ✅ Application not locked (unless `DRAFT` or `CLARIFICATION_REQUIRED`)

**Status After:** `UNDER_REVIEW`

**State Machine Transition:**
- `FORM_PENDING` → `UNDER_REVIEW`
- `CLARIFICATION_REQUIRED` → `UNDER_REVIEW` (resubmission)

---

### **PHASE 5: ADMIN REVIEW**

#### Step 8: Application Under Review
**Location:** `VendorApplicationUnderReview.tsx`

**Process:**
1. Vendor sees "Under Review" screen
2. Admin reviews application in admin panel
3. Admin can: APPROVE, REQUEST_CLARIFICATION, or REJECT

**API Endpoint:** `POST /admin/vendor/onboarding/:applicationId/review`  
**Handler:** `AdminReviewApplicationHandler`

**Admin Actions:**
1. **APPROVE:**
   - Status: `APPROVED`
   - Onboarding status: `APPROVED`
   - Creates audit trail

2. **REQUEST_CLARIFICATION:**
   - Status: `CLARIFICATION_REQUIRED`
   - Onboarding status: `CLARIFICATION_REQUIRED`
   - Unlocks application for editing
   - Stores admin comments

3. **REJECT:**
   - Status: `REJECTED`
   - Onboarding status: `REJECTED`
   - Stores rejection reason
   - Vendor can start over

**Database Updates:**
```sql
-- Update application status
UPDATE vendor_onboarding_applications 
SET status = ?, reviewed_by = ?, reviewed_at = NOW(), admin_comments = ?
WHERE id = ?;

-- Transition onboarding status
SELECT transition_onboarding_status(?, ?, ?, 'admin', ?, ?)
```

**Status After:** `APPROVED`, `CLARIFICATION_REQUIRED`, or `REJECTED`

---

### **PHASE 6: CLARIFICATION (If Required)**

#### Step 9: Clarification Requested
**Location:** `VendorClarificationRequested.tsx`

**Process:**
1. Vendor sees clarification request
2. Reviews admin comments
3. Can edit and resubmit application

**Status:** `CLARIFICATION_REQUIRED`

**Route:** `/onboarding/clarification`

**Next Steps:**
- Vendor edits form (application is unlocked)
- Resubmits application
- Status transitions back to `UNDER_REVIEW`

---

### **PHASE 7: APPROVAL & ACTIVATION**

#### Step 10: Application Approved
**Location:** `VendorApplicationApproved.tsx` (if exists) or redirect to activation

**Process:**
1. Vendor sees "Approved" screen
2. Clicks "Get Started" or "Activate"
3. System creates vendor record

**API Endpoint:** `POST /vendor/onboarding/activate`  
**Handler:** `ActivateVendorHandler`

**Database Operations:**
```sql
-- Create vendor record from application
INSERT INTO vendors (
  phone, email, business_name, owner_name,
  role_id, vendor_type, vendor_identity_id,
  onboarding_status, status, address, city, state, pincode,
  ...application_payload fields...
) VALUES (...);

-- Create setup completion record
INSERT INTO vendor_setup_completion (
  vendor_id,
  profile_completed, bank_account_completed,
  business_hours_completed, staff_management_completed,
  services_configured, is_go_live_ready
) VALUES (?, false, false, false, false, false, false);

-- Transition to ACTIVATED
SELECT transition_onboarding_status(?, 'ACTIVATED', ...)
```

**Validation Checks:**
- ✅ Onboarding status must be `APPROVED`
- ✅ Application exists and is approved
- ✅ All required application data present

**Status After:** `ACTIVATED`

**State Machine Transition:**
- `APPROVED` → `ACTIVATED` (terminal state)

---

### **PHASE 8: DASHBOARD LOADING**

#### Step 11: Dashboard Access
**Location:** `VendorDashboard.tsx` or `VendorCapabilityDashboard.tsx`

**Process:**
1. System checks vendor status (must be `ACTIVATED`)
2. Loads vendor profile with role information
3. Fetches role capabilities
4. Loads dashboard stats and bookings
5. Renders dynamic dashboard based on capabilities

**API Endpoints Called:**
```javascript
// Parallel API calls
GET /vendor/{vendorId}/profile
GET /vendor/{vendorId}/dashboard
GET /vendor/{vendorId}/bookings/today
GET /config/roles/{roleId}  // For capabilities
```

**Dashboard Loading Flow:**

1. **Load Vendor Profile:**
   ```javascript
   const vendorResponse = await apiClient.get(`/vendor/${vendorId}/profile`);
   // Returns: { vendor: { id, business_name, role_id, ... } }
   ```

2. **Load Role Capabilities:**
   ```javascript
   if (vendorResponse.vendor?.role_id) {
     const roleResponse = await apiClient.get(`/config/roles/${vendorResponse.vendor.role_id}`);
     // Returns: { capabilities: ['booking_create', 'prescription_create', ...] }
   }
   ```

3. **Filter Capabilities:**
   ```javascript
   const enabledCapabilities = ALL_CAPABILITIES.filter(cap => 
     capabilities.includes(cap.name) || 
     cap.category === 'core' // Core always shown
   );
   ```

4. **Render Dashboard:**
   - Core capabilities always shown (dashboard, bookings, profile, etc.)
   - Role-specific capabilities shown based on `role_permissions` table
   - Specialized sections rendered based on role (e.g., prescriptions for vets, tables for cafes)

**Database Queries:**
```sql
-- Get vendor
SELECT * FROM vendors WHERE id = ?;

-- Get role
SELECT * FROM roles WHERE id = ?;

-- Get role permissions (capabilities)
SELECT permission_name FROM role_permissions WHERE role_id = ?;
```

**Route Guard:**
- `/dashboard` only accessible if `onboarding_status = 'ACTIVATED'`
- Redirects to `/onboarding/status` if not activated

---

## 🎭 THE 20 VENDOR ROLES

### **Role Definition Structure**

Each role is stored in the `roles` table with:
- `id`: UUID
- `name`: Unique identifier (e.g., 'veterinarian')
- `display_name`: Human-readable name (e.g., 'Veterinarian')
- `description`: Role description
- `is_system_role`: Boolean
- `is_active`: Boolean
- `config`: JSONB containing:
  - `category`: Role category (healthcare, service_provider, hospitality, etc.)
  - `vendorTypes`: Supported vendor types (`["solo_provider", "center"]` or `["solo", "business"]`)
  - `serviceStyles`: Service delivery styles (`["at_center", "at_home", "tele"]`)
  - `capabilities`: Array of capability names
  - `onboardingFields`: Dynamic form schema

### **Role Seeding**

**Location:** `db/migrations/047_seed_roles.sql`

All 20 roles are seeded with:
- Complete configuration
- Capabilities mapping
- Onboarding form schemas (for veterinarian role, others have minimal schemas)

---

### **1. Healthcare Roles (1-7)**

#### 1. **Veterinarian** (`veterinarian`)
- **Category:** healthcare
- **Vendor Types:** solo_provider, center
- **Service Styles:** at_center, at_home, tele
- **Capabilities:** 
  - `medical_records`, `prescription_create`, `diagnostic_results`
  - `booking_create`, `booking_view`, `service_pricing`
- **Onboarding Fields:** Full schema with sections (basic, professional, documents, location, banking)

#### 2. **Veterinary Clinic** (`vet_clinic`)
- **Category:** healthcare
- **Vendor Types:** center
- **Service Styles:** at_center
- **Capabilities:**
  - `medical_records`, `prescription_create`, `diagnostic_results`
  - `staff_create`, `staff_schedule`, `booking_create`, `service_pricing`, `inventory_manage`

#### 3. **Pet Ambulance Service** (`ambulance`)
- **Category:** healthcare
- **Vendor Types:** solo_provider, center
- **Service Styles:** at_home
- **Capabilities:**
  - `gps_tracking`, `booking_create`, `booking_view`, `service_pricing`

#### 4. **Diagnostics Center** (`diagnostics_center`)
- **Category:** healthcare
- **Vendor Types:** center
- **Service Styles:** at_center, at_home
- **Capabilities:**
  - `diagnostic_results`, `booking_create`, `service_pricing`, `staff_create`

#### 5. **Pet Pharmacy** (`pharmacy`)
- **Category:** retail
- **Vendor Types:** center
- **Service Styles:** at_center
- **Capabilities:**
  - `inventory_manage`, `product_catalog`, `prescription_create`, `booking_create`

#### 6. **Pet Nutritionist** (`pet_nutritionist`)
- **Category:** healthcare
- **Vendor Types:** solo_provider, center
- **Service Styles:** at_center, at_home, tele
- **Capabilities:**
  - `booking_create`, `service_pricing`, `medical_records`

#### 7. **Pet Insurance Provider** (`pet_insurance`)
- **Category:** specialist
- **Vendor Types:** center
- **Service Styles:** tele
- **Capabilities:**
  - `booking_create`, `service_pricing`

---

### **2. Service Provider Roles (8-15)**

#### 8. **Pet Groomer** (`pet_groomer`)
- **Category:** service_provider
- **Vendor Types:** solo_provider, center
- **Service Styles:** at_center, at_home
- **Capabilities:**
  - `booking_create`, `booking_view`, `service_pricing`, `staff_schedule`

#### 9. **Pet Trainer** (`pet_trainer`)
- **Category:** service_provider
- **Vendor Types:** solo_provider, center
- **Service Styles:** at_center, at_home
- **Capabilities:**
  - `booking_create`, `service_pricing`, `staff_create`

#### 10. **Pet Walker** (`pet_walker`)
- **Category:** service_provider
- **Vendor Types:** solo_provider
- **Service Styles:** at_home
- **Capabilities:**
  - `gps_tracking`, `booking_create`, `booking_view`

#### 11. **Pet Sitter** (`pet_sitter`)
- **Category:** service_provider
- **Vendor Types:** solo_provider
- **Service Styles:** at_home
- **Capabilities:**
  - `booking_create`, `booking_view`, `service_pricing`

#### 12. **Pet Boarding** (`pet_boarder`)
- **Category:** hospitality
- **Vendor Types:** center
- **Service Styles:** at_center
- **Capabilities:**
  - `booking_create`, `service_pricing`, `staff_create`, `inventory_manage`

#### 13. **Pet Transport** (`pet_transport`)
- **Category:** service_provider
- **Vendor Types:** solo_provider, center
- **Service Styles:** at_home
- **Capabilities:**
  - `gps_tracking`, `booking_create`, `booking_view`

#### 14. **Pet Photographer** (`pet_photographer`)
- **Category:** specialist
- **Vendor Types:** solo_provider
- **Service Styles:** at_center, at_home
- **Capabilities:**
  - `booking_create`, `service_pricing`

#### 15. **Pet Spa** (`pet_spa`)
- **Category:** hospitality
- **Vendor Types:** center
- **Service Styles:** at_center
- **Capabilities:**
  - `booking_create`, `service_pricing`, `staff_create`, `staff_schedule`

---

### **3. Hospitality & Retail Roles (16-20)**

#### 16. **Pet Cafe** (`pet_cafe`)
- **Category:** hospitality
- **Vendor Types:** center
- **Service Styles:** at_center
- **Capabilities:**
  - `booking_create`, `inventory_manage`, `product_catalog`, `staff_create`

#### 17. **Pet Adoption Center** (`pet_adoption_center`)
- **Category:** specialist
- **Vendor Types:** center
- **Service Styles:** at_center
- **Capabilities:**
  - `booking_create`, `medical_records`, `staff_create`

#### 18. **Pet Event Organizer** (`pet_event_organizer`)
- **Category:** specialist
- **Vendor Types:** solo_provider, center
- **Service Styles:** at_center, at_home
- **Capabilities:**
  - `booking_create`, `service_pricing`

#### 19. **Pet Relocation Services** (`pet_relocation`)
- **Category:** specialist
- **Vendor Types:** center
- **Service Styles:** at_home
- **Capabilities:**
  - `booking_create`, `service_pricing`, `gps_tracking`

#### 20. **Pet Daycare** (`pet_daycare`)
- **Category:** hospitality
- **Vendor Types:** center
- **Service Styles:** at_center
- **Capabilities:**
  - `booking_create`, `service_pricing`, `staff_create`, `staff_schedule`

---

## ✅ VALIDATION CHECKS AT EACH STAGE

### **Stage 1: INIT (Phone Entry)**
- ✅ Phone number format validation
- ✅ OTP generation and verification
- ✅ Session token creation

### **Stage 2: ROLE_PENDING (Role Selection)**
- ✅ Role exists in database
- ✅ Role is active (`is_active = true`)
- ✅ Current status allows role selection
- ✅ State machine transition validation (`INIT` → `ROLE_PENDING`)

### **Stage 3: FORM_PENDING (Vendor Type Selection)**
- ✅ Role must be selected
- ✅ Vendor type must be `solo` or `business`
- ✅ Vendor type must be supported by role (`role.config.vendorTypes`)
- ✅ State machine transition validation (`ROLE_PENDING` → `FORM_PENDING`)

### **Stage 4: FORM_PENDING (Form Submission)**
- ✅ All required fields filled
- ✅ Documents uploaded (if required)
- ✅ Form schema version matches
- ✅ Application not locked (unless `DRAFT` or `CLARIFICATION_REQUIRED`)
- ✅ State machine transition validation (`FORM_PENDING` → `UNDER_REVIEW`)

### **Stage 5: UNDER_REVIEW (Admin Review)**
- ✅ Application exists
- ✅ Application status is `UNDER_REVIEW`
- ✅ Admin has permission to review
- ✅ State machine transition validation:
  - `UNDER_REVIEW` → `APPROVED`
  - `UNDER_REVIEW` → `CLARIFICATION_REQUIRED`
  - `UNDER_REVIEW` → `REJECTED`

### **Stage 6: CLARIFICATION_REQUIRED (If Applicable)**
- ✅ Application unlocked for editing
- ✅ Admin comments present
- ✅ Can resubmit (transitions to `UNDER_REVIEW`)

### **Stage 7: APPROVED (Activation)**
- ✅ Onboarding status is `APPROVED`
- ✅ Application exists and is approved
- ✅ All required application data present
- ✅ State machine transition validation (`APPROVED` → `ACTIVATED`)

### **Stage 8: ACTIVATED (Dashboard Access)**
- ✅ Onboarding status is `ACTIVATED`
- ✅ Vendor record exists
- ✅ Role ID present
- ✅ Capabilities loaded from `role_permissions`
- ✅ Route guard: `/dashboard` only accessible if `ACTIVATED`

---

## 🔍 DASHBOARD DYNAMIC LOADING PROCESS

### **Step-by-Step Dashboard Loading**

1. **Route Guard Check:**
   ```typescript
   // Check onboarding status
   const status = await getOnboardingStatus(phone);
   if (status !== 'ACTIVATED') {
     redirect(getRouteForStatus(status));
   }
   ```

2. **Load Vendor Profile:**
   ```typescript
   GET /vendor/{vendorId}/profile
   // Returns: { vendor: { id, business_name, role_id, ... } }
   ```

3. **Load Role Configuration:**
   ```typescript
   GET /config/roles/{roleId}
   // Returns: { 
   //   id, name, display_name, description,
   //   config: { capabilities: [...], vendorTypes: [...], ... }
   // }
   ```

4. **Load Role Permissions (Capabilities):**
   ```sql
   SELECT permission_name FROM role_permissions WHERE role_id = ?;
   ```

5. **Filter Capabilities:**
   ```typescript
   const enabledCapabilities = ALL_CAPABILITIES.filter(cap => 
     capabilities.includes(cap.name) || 
     cap.category === 'core' // Core always shown
   );
   ```

6. **Group Capabilities by Category:**
   ```typescript
   const groupedCapabilities = enabledCapabilities.reduce((acc, cap) => {
     if (!acc[cap.category]) acc[cap.category] = [];
     acc[cap.category].push(cap);
     return acc;
   }, {});
   ```

7. **Render Dashboard:**
   - Core capabilities always shown (dashboard, bookings, profile, etc.)
   - Role-specific capabilities shown based on permissions
   - Specialized sections rendered conditionally

### **Capability Categories**

1. **Core:** Always shown (dashboard, bookings, profile, services, staff, schedule)
2. **Services:** Service-specific capabilities
3. **Specialized:** Role-specific features (prescriptions, diagnostics, etc.)
4. **Operations:** Business operations (reviews, analytics, reports, settings)
5. **Finance:** Financial features (earnings, settlements, bank account, pricing)
6. **Communication:** Communication features (chat, notifications, video calls)

### **45+ Capabilities Defined**

**Location:** `apps/vendor-web/components/vendor/VendorCapabilityDashboard.tsx`

All capabilities are defined in `ALL_CAPABILITIES` array with:
- `id`: Unique identifier
- `name`: Capability name (matches `role_permissions.permission_name`)
- `display_name`: Human-readable name
- `icon`: Emoji icon
- `description`: Capability description
- `category`: Category (core, services, specialized, operations, finance, communication)
- `route`: Frontend route

---

## ⚠️ MISSING PIECES IN WIREFRAME IMPLEMENTATION

### **1. Route Guards Not Fully Implemented**

**Issue:** Route guards exist in `route-map.ts` but may not be enforced in all components.

**Missing:**
- Route guard middleware in Next.js app router
- Automatic redirect based on onboarding status
- Status check on page load/refresh

**Location:** `apps/vendor-web/app/onboarding/route-map.ts`

**Recommendation:**
- Implement middleware to check onboarding status on route access
- Add automatic redirects based on `getRedirectRoute()` function

---

### **2. Dynamic Form Schema Implementation**

**Issue:** Only `veterinarian` role has complete onboarding form schema. Other 19 roles have minimal/empty schemas.

**Missing:**
- Complete form schemas for all 20 roles
- Form schema versioning
- Field validation rules in schema

**Location:** `db/migrations/047_seed_roles.sql`

**Current State:**
- Veterinarian: Full schema with 5 sections and multiple fields
- Other roles: Empty or minimal schemas (`{"version": 1, "sections": [], "fields": []}`)

**Recommendation:**
- Create complete form schemas for all 20 roles
- Add field-level validation rules
- Implement schema versioning

---

### **3. Capability-to-Permission Mapping**

**Issue:** Dashboard capabilities are hardcoded in frontend, but backend permissions may not match.

**Missing:**
- Complete mapping between frontend capabilities and backend `role_permissions`
- Permission seeding for all 20 roles
- Capability enforcement middleware on API endpoints

**Location:**
- Frontend: `apps/vendor-web/components/vendor/VendorCapabilityDashboard.tsx`
- Backend: `backend/lambda/src/middleware/capability-enforcement.ts`

**Recommendation:**
- Seed `role_permissions` for all 20 roles
- Ensure frontend capabilities match backend permissions
- Add capability checks to API endpoints

---

### **4. Specialized Dashboard Sections**

**Issue:** Many specialized sections are placeholders (e.g., `CafeTablesSection`, `RoomsSection`).

**Missing:**
- Full implementation of specialized sections:
  - Cafe Tables Management
  - Room Management (Boarding)
  - Insurance Plans
  - Adoption Listings
  - Meal Plans
  - Walking Sessions
  - Ambulance Dispatch
  - Diagnostics
  - Holiday Packages
  - Products (E-commerce)
  - Training Programs

**Location:** `apps/vendor-web/components/vendor/VendorCapabilityDashboard.tsx` (lines 844-900)

**Current State:**
- Most specialized sections return `<SpecializedPlaceholder />`
- Only basic sections (Services, Staff, Bookings, Earnings, Schedule, Profile) are implemented

**Recommendation:**
- Implement all specialized sections based on role requirements
- Create dedicated components for each specialized section
- Add API endpoints for specialized features

---

### **5. Post-Activation Setup Flow**

**Issue:** Post-activation setup completion tracking exists but UI flow may be incomplete.

**Missing:**
- UI for post-activation setup steps:
  - Profile completion
  - Bank account setup
  - Business hours configuration
  - Staff management setup
  - Services configuration
  - Go-live checklist

**Location:**
- Database: `vendor_setup_completion` table
- API: `POST /vendor/setup/update-completion`, `POST /vendor/setup/go-live`

**Recommendation:**
- Create post-activation setup wizard
- Add progress tracking UI
- Implement go-live readiness checks

---

### **6. State Machine Transition Validation**

**Issue:** State machine validation exists in database but may not be enforced in all API handlers.

**Missing:**
- Consistent use of `transition_onboarding_status()` function
- Error handling for invalid transitions
- Audit trail verification

**Location:**
- Database: `db/migrations/049_vendor_onboarding_state_machine.sql`
- API: `backend/lambda/src/endpoints/vendor-onboarding.ts`

**Recommendation:**
- Ensure all status transitions use `transition_onboarding_status()`
- Add error handling for invalid transitions
- Verify audit trail creation

---

### **7. Role Configuration Completeness**

**Issue:** Role configurations may be incomplete for some roles.

**Missing:**
- Complete `onboardingFields` for all roles
- Service catalog mappings
- Pricing rules per role
- Staff management rules per role

**Location:** `db/migrations/047_seed_roles.sql`

**Recommendation:**
- Complete role configurations
- Add service catalog mappings
- Define pricing and staff rules per role

---

### **8. Dashboard Stats Loading**

**Issue:** Dashboard stats endpoint may not return all required data.

**Missing:**
- Complete stats calculation
- Real-time booking counts
- Earnings calculations
- Pending settlement amounts

**Location:**
- API: `GET /vendor/{vendorId}/dashboard`
- Frontend: `VendorCapabilityDashboard.tsx` (loadDashboardData)

**Recommendation:**
- Implement complete stats calculation
- Add real-time data updates
- Calculate earnings and settlements accurately

---

## 📊 FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                    VENDOR SIGNUP TO DASHBOARD FLOW           │
└─────────────────────────────────────────────────────────────┘

1. INIT
   ├─ Enter Phone → OTP Verification
   └─ Status: INIT

2. ROLE_PENDING
   ├─ Load 20 Roles (GET /vendor/onboarding/roles)
   ├─ Select Role (POST /vendor/onboarding/select-role)
   └─ Status: ROLE_PENDING

3. FORM_PENDING
   ├─ Select Vendor Type (solo/business)
   ├─ Load Dynamic Form Schema (GET /vendor/onboarding/form-schema)
   ├─ Fill Form & Upload Documents
   ├─ Submit Application (POST /vendor/onboarding/submit-application)
   └─ Status: UNDER_REVIEW

4. UNDER_REVIEW
   ├─ Admin Reviews Application
   ├─ Admin Actions:
   │   ├─ APPROVE → Status: APPROVED
   │   ├─ REQUEST_CLARIFICATION → Status: CLARIFICATION_REQUIRED
   │   └─ REJECT → Status: REJECTED
   └─ Status: APPROVED / CLARIFICATION_REQUIRED / REJECTED

5. CLARIFICATION_REQUIRED (if applicable)
   ├─ Vendor Reviews Admin Comments
   ├─ Edit Application
   ├─ Resubmit
   └─ Status: UNDER_REVIEW (back to step 4)

6. APPROVED
   ├─ Vendor Clicks "Activate"
   ├─ Create Vendor Record (POST /vendor/onboarding/activate)
   ├─ Create Setup Completion Record
   └─ Status: ACTIVATED

7. ACTIVATED → DASHBOARD
   ├─ Load Vendor Profile (GET /vendor/{vendorId}/profile)
   ├─ Load Role Configuration (GET /config/roles/{roleId})
   ├─ Load Role Permissions (SELECT from role_permissions)
   ├─ Filter Capabilities
   ├─ Load Dashboard Stats (GET /vendor/{vendorId}/dashboard)
   ├─ Load Today's Bookings (GET /vendor/{vendorId}/bookings/today)
   └─ Render Dynamic Dashboard
```

---

## 🔗 KEY FILES REFERENCED

1. **Onboarding Flow:**
   - `apps/vendor-web/components/vendor/VendorOnboardingFlow.tsx`
   - `apps/vendor-web/components/vendor/VendorRoleSelection.tsx`
   - `backend/lambda/src/endpoints/vendor-onboarding.ts`

2. **State Machine:**
   - `db/migrations/049_vendor_onboarding_state_machine.sql`
   - `apps/vendor-web/app/onboarding/route-map.ts`

3. **Role Definitions:**
   - `db/migrations/047_seed_roles.sql`
   - `backend/lambda/src/endpoints/vendor-onboarding.ts` (GetAvailableRolesHandler)

4. **Dashboard Loading:**
   - `apps/vendor-web/components/vendor/VendorCapabilityDashboard.tsx`
   - `apps/vendor-web/components/vendor/VendorDashboard.tsx`
   - `backend/lambda/src/middleware/capability-enforcement.ts`

5. **Vendor App Router:**
   - `apps/vendor-web/components/vendor/VendorApp.tsx`

---

## ✅ SUMMARY

### **Complete Flow:**
✅ Phone entry → OTP verification → Role selection → Vendor type → Dynamic form → Submission → Admin review → Approval → Activation → Dashboard

### **20 Roles:**
✅ All 20 roles defined in database with configurations, capabilities, and vendor type support

### **Validation Checks:**
✅ State machine transitions validated, role permissions checked, form validation, admin review workflow

### **Dashboard Loading:**
✅ Dynamic capability-based dashboard loading with role-specific features

### **Missing Pieces:**
⚠️ Route guards, complete form schemas, capability-to-permission mapping, specialized sections, post-activation setup UI, state machine enforcement, role configuration completeness, dashboard stats

---

**End of Document**

