# Vendor Onboarding - Complete Database-Driven Implementation

## Overview

This document describes the complete, database-driven vendor onboarding system with state machine, role-based dynamic forms, and admin approval workflow.

**CRITICAL PRINCIPLES:**
- ✅ All state transitions persist in database
- ✅ All screens recoverable on refresh
- ✅ All permissions from role configuration
- ❌ No hardcoded roles, forms, or capabilities
- ❌ No UI-only state transitions

---

## State Machine Diagram

```
┌─────────┐
│  INIT   │ ───────────────────────────────────────────┐
└────┬────┘                                              │
     │                                                    │
     ▼                                                    │
┌─────────────────┐                                      │
│ ROLE_PENDING    │ ────────────────────────────────────┤
└────┬────────────┘                                      │
     │                                                    │
     ▼                                                    │
┌─────────────────┐                                      │
│ FORM_PENDING    │                                      │
└────┬────────────┘                                      │
     │                                                    │
     ▼                                                    │
┌─────────────────┐                                      │
│ UNDER_REVIEW    │ ──────┐                              │
└────┬────────────┘       │                              │
     │                     │                              │
     ├─────────────────────┼────────────────────────────┤
     │                     │                              │
     ▼                     ▼                              ▼
┌─────────────┐  ┌──────────────────────┐  ┌─────────────┐
│  APPROVED   │  │CLARIFICATION_REQUIRED│  │  REJECTED   │
└──────┬──────┘  └──────┬───────────────┘  └──────┬─────┘
       │                 │                          │
       │                 │                          │
       │                 ▼                          │
       │         ┌─────────────────┐                │
       │         │ UNDER_REVIEW    │                │
       │         └─────────────────┘                │
       │                                             │
       ▼                                             │
┌─────────────┐                                      │
│ ACTIVATED   │ ◄────────────────────────────────────┘
└─────────────┘
     │
     │ (Terminal State)
     │
     ▼
  [Dashboard]
```

### Valid Transitions

| From Status | To Status | Trigger | Notes |
|------------|-----------|---------|-------|
| INIT | ROLE_PENDING | User selects role | First step after OTP |
| ROLE_PENDING | FORM_PENDING | User selects vendor type | After role + type selection |
| ROLE_PENDING | INIT | User cancels/restarts | Can restart onboarding |
| FORM_PENDING | UNDER_REVIEW | User submits application | Application locked |
| FORM_PENDING | ROLE_PENDING | User changes role | Can go back |
| UNDER_REVIEW | APPROVED | Admin approves | Vendor can activate |
| UNDER_REVIEW | CLARIFICATION_REQUIRED | Admin requests clarification | Application unlocked |
| UNDER_REVIEW | REJECTED | Admin rejects | Can restart |
| CLARIFICATION_REQUIRED | UNDER_REVIEW | Vendor resubmits | After addressing comments |
| CLARIFICATION_REQUIRED | REJECTED | Admin rejects | After clarification |
| APPROVED | ACTIVATED | Vendor clicks "Get Started" | Creates vendor record |
| REJECTED | ROLE_PENDING | User restarts | Can choose new role |
| REJECTED | INIT | User restarts | Full reset |
| ACTIVATED | - | - | Terminal state (no transitions) |

---

## Database Schema

### Core Tables

1. **vendor_identity** - Authentication & onboarding state
2. **vendor_onboarding_applications** - Application submissions
3. **vendor_onboarding_transitions** - Audit trail
4. **vendor_setup_completion** - Post-activation setup tracking
5. **roles** - Role configuration (with `config` JSONB)

### Key Columns

**vendor_identity:**
- `phone` (unique)
- `onboarding_status` (enum)
- `selected_role_id`
- `vendor_type` (solo/business)
- `application_id`

**vendor_onboarding_applications:**
- `application_payload` (JSONB - dynamic form data)
- `uploaded_documents` (JSONB array)
- `status` (DRAFT/SUBMITTED/UNDER_REVIEW/etc.)
- `is_locked` (prevents edits after submission)

---

## API Contract

### Phase 1: Auth & Entry

#### GET `/vendor/onboarding/status?phone={phone}`
Returns current onboarding status and next step.

**Response:**
```json
{
  "success": true,
  "identity": {
    "id": "uuid",
    "phone": "+919876543210",
    "onboarding_status": "INIT",
    "selected_role_id": null,
    "vendor_type": null
  },
  "application": null,
  "role": null,
  "nextStep": "/onboarding/role-selection"
}
```

### Phase 2: Role Selection

#### GET `/vendor/onboarding/roles`
Returns all available roles with configuration.

**Response:**
```json
{
  "success": true,
  "roles": [
    {
      "id": "uuid",
      "name": "groomer",
      "display_name": "Pet Groomer",
      "description": "Professional pet grooming services",
      "vendor_types_supported": ["solo", "business"],
      "capabilities": ["manage_bookings", "manage_staff"],
      "config": { ... }
    }
  ]
}
```

#### POST `/vendor/onboarding/select-role`
Selects a role for onboarding.

**Request:**
```json
{
  "phone": "+919876543210",
  "role_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role selected successfully",
  "nextStep": "/onboarding/vendor-type"
}
```

### Phase 3: Vendor Type

#### POST `/vendor/onboarding/select-vendor-type`
Selects vendor type (solo/business).

**Request:**
```json
{
  "phone": "+919876543210",
  "vendor_type": "solo"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Vendor type selected successfully",
  "nextStep": "/onboarding/form"
}
```

### Phase 4: Dynamic Form

#### GET `/vendor/onboarding/form-schema?phone={phone}`
Returns form schema for current role + vendor_type.

**Response:**
```json
{
  "success": true,
  "schema": {
    "version": "1.0",
    "fields": [
      {
        "name": "businessName",
        "label": "Business Name",
        "type": "text",
        "required": true,
        "validation": { "minLength": 3 }
      },
      {
        "name": "ownerName",
        "label": "Owner Name",
        "type": "text",
        "required": true
      },
      {
        "name": "email",
        "label": "Email",
        "type": "email",
        "required": true
      },
      {
        "name": "gstNumber",
        "label": "GST Number",
        "type": "text",
        "required": false,
        "conditional": {
          "showIf": { "vendorType": "business" }
        }
      },
      {
        "name": "registrationCertificate",
        "label": "Registration Certificate",
        "type": "file",
        "required": true,
        "accept": ["pdf", "jpg", "png"],
        "maxSize": 5242880
      }
    ]
  },
  "existingApplication": null,
  "canEdit": true
}
```

#### POST `/vendor/onboarding/submit-application`
Submits application with form data.

**Request:**
```json
{
  "phone": "+919876543210",
  "application_payload": {
    "businessName": "Pawsome Grooming",
    "ownerName": "John Doe",
    "email": "john@pawsome.com",
    "address": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  },
  "uploaded_documents": [
    {
      "type": "registrationCertificate",
      "url": "https://s3.../doc.pdf",
      "name": "registration.pdf",
      "size": 1024000
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Application submitted successfully",
  "applicationId": "uuid",
  "nextStep": "/onboarding/pending-review"
}
```

### Phase 6: Admin Review

#### POST `/admin/vendor/onboarding/{applicationId}/review`
Admin reviews application.

**Request (APPROVE):**
```json
{
  "action": "APPROVE",
  "admin_id": "uuid",
  "comments": "Application looks good"
}
```

**Request (REQUEST_CLARIFICATION):**
```json
{
  "action": "REQUEST_CLARIFICATION",
  "admin_id": "uuid",
  "comments": "Please provide GST certificate for business registration"
}
```

**Request (REJECT):**
```json
{
  "action": "REJECT",
  "admin_id": "uuid",
  "rejection_reason": "Incomplete documentation",
  "comments": "Missing required documents"
}
```

### Phase 7: Activation

#### POST `/vendor/onboarding/activate`
Activates vendor (creates vendor record).

**Request:**
```json
{
  "phone": "+919876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Vendor activated successfully",
  "vendor_id": "uuid",
  "nextStep": "/dashboard"
}
```

### Phase 8: Post-Activation Setup

#### POST `/vendor/setup/update-completion`
Updates setup step completion.

**Request:**
```json
{
  "vendor_id": "uuid",
  "step": "profile",
  "completed": true
}
```

#### POST `/vendor/setup/go-live`
Marks vendor as go-live ready.

**Request:**
```json
{
  "vendor_id": "uuid"
}
```

---

## Frontend Routing Map

### Route Structure

```
/vendor
├── /auth
│   └── /otp                    # OTP verification
│
├── /onboarding
│   ├── /role-selection         # Phase 2: Select role
│   ├── /vendor-type            # Phase 3: Select solo/business
│   ├── /form                   # Phase 4: Dynamic form
│   ├── /pending-review         # Waiting for admin
│   ├── /clarification          # Admin requested changes
│   ├── /approved               # Application approved
│   └── /rejected               # Application rejected
│
└── /dashboard                  # Post-activation
    ├── /profile                # Profile setup
    ├── /bank-details           # Bank account setup
    ├── /schedule               # Business hours
    ├── /staff                  # Staff management
    ├── /services               # Service configuration
    └── /go-live                # Go-live checklist
```

### Route Guards

Each route checks `onboarding_status` and redirects if invalid:

```typescript
// Example: /onboarding/form
if (onboarding_status !== 'FORM_PENDING' && onboarding_status !== 'CLARIFICATION_REQUIRED') {
  redirect('/onboarding/role-selection');
}
```

### State Recovery on Refresh

On page load:
1. Call `GET /vendor/onboarding/status?phone={phone}`
2. Check `onboarding_status`
3. Redirect to `nextStep` from response
4. Load existing data if available

---

## Role Configuration JSON Schema

### Example: Pet Groomer Role

```json
{
  "vendorTypes": ["solo", "business"],
  "capabilities": [
    "manage_bookings",
    "manage_staff",
    "manage_services",
    "view_earnings"
  ],
  "serviceCatalogMapping": [
    "grooming_basic",
    "grooming_premium",
    "nail_trimming",
    "ear_cleaning"
  ],
  "onboardingFormSchema": {
    "solo": {
      "version": "1.0",
      "fields": [
        {
          "name": "businessName",
          "label": "Business Name",
          "type": "text",
          "required": true,
          "validation": {
            "minLength": 3,
            "maxLength": 100
          }
        },
        {
          "name": "ownerName",
          "label": "Your Name",
          "type": "text",
          "required": true
        },
        {
          "name": "email",
          "label": "Email Address",
          "type": "email",
          "required": true
        },
        {
          "name": "alternatePhone",
          "label": "Alternate Phone",
          "type": "tel",
          "required": false
        },
        {
          "name": "address",
          "label": "Business Address",
          "type": "text",
          "required": true
        },
        {
          "name": "city",
          "label": "City",
          "type": "text",
          "required": true
        },
        {
          "name": "state",
          "label": "State",
          "type": "select",
          "required": true,
          "options": [
            "Maharashtra",
            "Delhi",
            "Karnataka"
          ]
        },
        {
          "name": "pincode",
          "label": "Pincode",
          "type": "text",
          "required": true,
          "validation": {
            "pattern": "^[0-9]{6}$"
          }
        },
        {
          "name": "experienceYears",
          "label": "Years of Experience",
          "type": "number",
          "required": true,
          "validation": {
            "min": 0,
            "max": 50
          }
        },
        {
          "name": "specialization",
          "label": "Specialization",
          "type": "multiselect",
          "required": false,
          "options": [
            "Small Dogs",
            "Large Dogs",
            "Cats",
            "Exotic Pets"
          ]
        },
        {
          "name": "idProof",
          "label": "ID Proof (Aadhaar/PAN)",
          "type": "file",
          "required": true,
          "accept": ["pdf", "jpg", "png"],
          "maxSize": 5242880
        }
      ]
    },
    "business": {
      "version": "1.0",
      "fields": [
        {
          "name": "businessName",
          "label": "Business Name",
          "type": "text",
          "required": true
        },
        {
          "name": "ownerName",
          "label": "Owner/Authorized Person Name",
          "type": "text",
          "required": true
        },
        {
          "name": "email",
          "label": "Business Email",
          "type": "email",
          "required": true
        },
        {
          "name": "registrationNumber",
          "label": "Business Registration Number",
          "type": "text",
          "required": true
        },
        {
          "name": "gstNumber",
          "label": "GST Number",
          "type": "text",
          "required": true,
          "validation": {
            "pattern": "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
          }
        },
        {
          "name": "panNumber",
          "label": "PAN Number",
          "type": "text",
          "required": true,
          "validation": {
            "pattern": "^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
          }
        },
        {
          "name": "address",
          "label": "Registered Business Address",
          "type": "text",
          "required": true
        },
        {
          "name": "city",
          "label": "City",
          "type": "text",
          "required": true
        },
        {
          "name": "state",
          "label": "State",
          "type": "select",
          "required": true,
          "options": ["Maharashtra", "Delhi", "Karnataka"]
        },
        {
          "name": "pincode",
          "label": "Pincode",
          "type": "text",
          "required": true
        },
        {
          "name": "registrationCertificate",
          "label": "Registration Certificate",
          "type": "file",
          "required": true,
          "accept": ["pdf"],
          "maxSize": 10485760
        },
        {
          "name": "gstCertificate",
          "label": "GST Certificate",
          "type": "file",
          "required": true,
          "accept": ["pdf"],
          "maxSize": 10485760
        },
        {
          "name": "panCard",
          "label": "PAN Card",
          "type": "file",
          "required": true,
          "accept": ["pdf", "jpg", "png"],
          "maxSize": 5242880
        }
      ]
    }
  }
}
```

### Example: Veterinary Clinic Role

```json
{
  "vendorTypes": ["business"],
  "capabilities": [
    "manage_bookings",
    "manage_staff",
    "manage_services",
    "prescribe_medications",
    "view_medical_records"
  ],
  "serviceCatalogMapping": [
    "consultation",
    "vaccination",
    "surgery",
    "emergency_care"
  ],
  "onboardingFormSchema": {
    "business": {
      "version": "1.0",
      "fields": [
        {
          "name": "clinicName",
          "label": "Clinic Name",
          "type": "text",
          "required": true
        },
        {
          "name": "licenseNumber",
          "label": "Veterinary License Number",
          "type": "text",
          "required": true
        },
        {
          "name": "licenseCertificate",
          "label": "License Certificate",
          "type": "file",
          "required": true,
          "accept": ["pdf"],
          "maxSize": 10485760
        },
        {
          "name": "numberOfVets",
          "label": "Number of Veterinarians",
          "type": "number",
          "required": true,
          "validation": {
            "min": 1
          }
        },
        {
          "name": "facilities",
          "label": "Available Facilities",
          "type": "multiselect",
          "required": true,
          "options": [
            "X-Ray",
            "Ultrasound",
            "Surgery Room",
            "ICU",
            "Pharmacy"
          ]
        }
      ]
    }
  }
}
```

---

## Error Handling & Edge Cases

### 1. Page Refresh During Onboarding

**Problem:** User refreshes page mid-onboarding.

**Solution:**
- On page load, call `GET /vendor/onboarding/status`
- Check `onboarding_status`
- Redirect to appropriate step
- Load existing data (role, form data, etc.)

### 2. Application Locked (Already Submitted)

**Problem:** User tries to edit submitted application.

**Solution:**
- Check `application.is_locked` flag
- Show read-only view if locked
- Only allow edits if `status === 'CLARIFICATION_REQUIRED'`

### 3. Role/Vendor Type Changed After Form Started

**Problem:** User changes role or vendor type after starting form.

**Solution:**
- Clear existing application
- Reset to appropriate step
- Load new form schema

### 4. Admin Rejection → Restart

**Problem:** Vendor wants to restart after rejection.

**Solution:**
- Clear `selected_role_id` and `vendor_type`
- Reset `onboarding_status` to `INIT` or `ROLE_PENDING`
- Allow fresh start

### 5. Network Failure During Submission

**Problem:** Network fails while submitting application.

**Solution:**
- Save form data to localStorage as draft
- Retry on reconnect
- Show "Resume" option if draft exists

### 6. OTP Expiry

**Problem:** OTP expires during onboarding.

**Solution:**
- Check OTP validity on each API call
- Redirect to OTP screen if invalid
- Preserve onboarding state (don't reset)

### 7. Concurrent Admin Review

**Problem:** Multiple admins review same application.

**Solution:**
- Use database locks (`is_locked` flag)
- First admin locks application
- Others see "Under review by [Admin Name]"

---

## Production Readiness Checklist

### Database
- [ ] Migration `049_vendor_onboarding_state_machine.sql` applied
- [ ] All indexes created
- [ ] State machine functions tested
- [ ] Foreign key constraints verified

### API
- [ ] All endpoints registered in `handler/index.ts`
- [ ] Error handling tested
- [ ] Input validation implemented
- [ ] Rate limiting configured
- [ ] Authentication middleware added

### Frontend
- [ ] All routes created with guards
- [ ] State recovery on refresh implemented
- [ ] Form validation matches schema
- [ ] File upload working
- [ ] Error messages user-friendly
- [ ] Loading states implemented

### Role Configuration
- [ ] All roles have `config` JSONB populated
- [ ] `onboardingFormSchema` defined for each role
- [ ] `vendorTypes` array correct
- [ ] Form schemas validated

### Admin Panel
- [ ] Review interface implemented
- [ ] Comments system working
- [ ] Notification on new applications
- [ ] Bulk actions if needed

### Testing
- [ ] Happy path tested (INIT → ACTIVATED)
- [ ] Rejection flow tested
- [ ] Clarification flow tested
- [ ] Page refresh recovery tested
- [ ] Concurrent access tested
- [ ] Error scenarios tested

### Monitoring
- [ ] State transition logging
- [ ] Application submission metrics
- [ ] Admin review time tracking
- [ ] Error rate monitoring

### Documentation
- [ ] API documentation complete
- [ ] Role configuration guide
- [ ] Admin review guide
- [ ] Troubleshooting guide

---

## State Machine Guards

### Database Functions

1. **`validate_onboarding_transition(from, to)`**
   - Validates if transition is allowed
   - Returns boolean

2. **`transition_onboarding_status(identity_id, to_status, ...)`**
   - Safely transitions state
   - Creates audit trail
   - Throws error if invalid

3. **`get_onboarding_form_schema(role_id, vendor_type)`**
   - Returns form schema from role config
   - Returns NULL if not found

4. **`is_vendor_go_live_ready(vendor_id)`**
   - Checks all setup steps completed
   - Returns boolean

---

## Next Steps

1. **Run Migration:**
   ```bash
   npm run migrate:up
   ```

2. **Seed Role Configurations:**
   - Update existing roles with `onboardingFormSchema`
   - Test form generation

3. **Implement Frontend:**
   - Create route components
   - Implement dynamic form renderer
   - Add state recovery logic

4. **Admin Panel:**
   - Build review interface
   - Add notification system

5. **Testing:**
   - End-to-end flow testing
   - Edge case testing
   - Performance testing

---

## Support

For issues or questions:
- Check state machine transitions in `vendor_onboarding_transitions` table
- Review role configuration in `roles.config` JSONB
- Check application status in `vendor_onboarding_applications` table

