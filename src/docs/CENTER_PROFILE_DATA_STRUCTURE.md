# Center Profile CRUD - Data Structure & Database Schema

## Overview
This document describes the complete data structure for center/vendor profiles with full CRUD operations, specialization selection, and KV store indexes.

---

## KV Store Keys & Indexes

### Primary Keys
```
vendor:{vendorId}                          // Main vendor/center profile
vendor:vendor_{phoneNumber}                 // Indexed by phone (normalized)
vendor:pending_approvals                    // Array of pending vendor IDs
```

### Specialization Indexes
```
specialization:vendor:{vendorId}            // Vendor's specializations (array of IDs)
specialization:role:{roleId}                // Available specializations for role
problem:specialization:{specializationId}   // Problems this specialization helps with
```

### Search Indexes (for quick lookups)
```
vendor:by_phone:{normalizedPhone}          // Direct phone lookup
vendor:by_email:{email}                    // Email lookup
vendor:by_specialization:{specId}          // All vendors with this specialization
vendor:by_role:{roleId}                    // All vendors with this role
vendor:by_status:{status}                  // Status-based queries
```

---

## Data Structure

### Vendor Profile Object
```typescript
interface VendorProfile {
  // Identity
  id: string;                              // vendor_1234567890
  applicationId: string;                   // APP1234567890ABC
  
  // Role & Classification
  roleId: string;                          // Role configuration ID
  roleName: string;                        // "Pet Clinic", "Groomer", etc.
  vendorType: string;                      // "clinic", "groomer", "trainer"
  serviceCategory: string;                 // "veterinary", "grooming", etc.
  serviceStyle: string;                    // "home_service", "at_center", "both"
  
  // ✅ NEW: Specializations
  specializations: string[];               // Array of specialization IDs
  specializationDetails?: Array<{          // Enriched specialization data
    id: string;
    name: string;
    description: string;
    helpsWithProblems: Array<{
      id: string;
      name: string;
      icon: string;
    }>;
  }>;
  
  // Business Information
  businessName: string | null;
  fullName: string | null;
  displayName: string;                     // Computed from businessName or fullName
  
  // Contact
  phone: string;                           // 10-digit normalized
  email: string | null;
  
  // Location
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  location: {                              // GPS coordinates
    lat: number;
    lng: number;
  } | null;
  coordinates: {                           // Alternative GPS field
    lat: number;
    lng: number;
  } | null;
  
  // Business Details
  gstNumber: string | null;
  yearsOfExperience: number;
  
  // Bank Details
  bankDetails: {
    accountHolderName: string | null;
    accountNumber: string | null;
    ifscCode: string | null;
    bankName: string | null;
    branchName: string | null;
  };
  
  // Documents
  documents: Array<{
    name: string;
    type: string;
    category: string;
    preview: string;                       // Base64 or URL
    url: string;                           // Cloud storage URL
    fileName: string;
    fileType: string;
    uploadedAt: string;                    // ISO timestamp
  }>;
  documentsRaw: Record<string, any>;       // Original document object
  
  // Custom Form Fields
  customFields: Record<string, any>;       // All form data from dynamic form
  formData?: Record<string, any>;          // Alternative storage for form data
  
  // Status & Approval
  status: 'pending_approval' | 'approved' | 'rejected' | 'more_info_required';
  setupCompleted: boolean;
  isActive: boolean;
  
  // Timestamps
  createdAt: string;                       // ISO timestamp
  submittedAt: string;                     // When application was submitted
  updatedAt: string;                       // Last modification
  lastProfileUpdate?: string;              // Last profile edit (for CRUD)
  reviewedAt?: string;                     // When admin reviewed
  approvedAt?: string;                     // When approved
  rejectedAt?: string;                     // When rejected
  
  // Progress Tracking
  onboardingProgress: number;              // 0-100
  applicationComplete: boolean;
  
  // Reapplication Tracking
  isReapplication: boolean;
  reapplicationCount: number;
  applicationHistory?: Array<{             // Previous applications
    applicationId: string;
    status: string;
    submittedAt: string;
    reviewedAt: string;
    rejectionReason?: string;
    reviewedBy?: string;
  }>;
  rejectionReason?: string;
  reviewedBy?: string;
  
  // Version Control
  formVersion?: number;                    // Dynamic form version used
}
```

---

## API Endpoints

### 1. Create/Submit Application
**POST** `/make-server-3dd53475/vendor/apply`

**Request Body:**
```json
{
  "roleId": "role_clinic_001",
  "phone": "9876543210",
  "email": "clinic@example.com",
  "serviceStyle": "both",
  "location": { "lat": 28.6139, "lng": 77.2090 },
  "specializations": ["spec_vaccination", "spec_surgery", "spec_dental"],
  "formData": {
    "businessName": "Happy Paws Clinic",
    "fullName": "Dr. John Doe",
    "address": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "yearsOfExperience": 5,
    "gstNumber": "27XXXXX1234X1Z5"
  },
  "documents": {
    "businessLicense": {
      "name": "license.pdf",
      "type": "application/pdf",
      "size": 123456,
      "url": "https://storage.example.com/license.pdf"
    }
  },
  "agreedToTerms": true,
  "formVersion": 1
}
```

**Response:**
```json
{
  "success": true,
  "applicationId": "APP1234567890ABC",
  "vendorId": "vendor_9876543210",
  "message": "Application submitted successfully. You will be notified once reviewed."
}
```

---

### 2. Update Profile (Edit Mode)
**PUT** `/make-server-3dd53475/vendor/profile/:vendorId`

**Request Body:**
```json
{
  "formData": {
    "businessName": "Happy Paws Clinic (Updated)",
    "yearsOfExperience": 6
  },
  "specializations": ["spec_vaccination", "spec_surgery", "spec_dental", "spec_emergency"],
  "location": { "lat": 28.6139, "lng": 77.2090 },
  "documents": []
}
```

**Response:**
```json
{
  "success": true,
  "vendorId": "vendor_9876543210",
  "message": "Profile updated successfully",
  "vendor": { /* full vendor object */ }
}
```

---

### 3. Load Profile for Editing
**GET** `/make-server-3dd53475/vendor/profile/:vendorId`

**Response:**
```json
{
  "success": true,
  "vendor": {
    "id": "vendor_9876543210",
    "formData": { /* all form fields */ },
    "specializations": ["spec_vaccination", "spec_surgery"],
    "location": { "lat": 28.6139, "lng": 77.2090 },
    "documents": [ /* array of documents */ ]
  }
}
```

---

### 4. Get Available Specializations
**GET** `/make-server-3dd53475/vendor/problem-grid-specializations/:roleId`

**Response:**
```json
{
  "success": true,
  "roleId": "role_clinic_001",
  "roleName": "Pet Clinic",
  "specializations": [
    {
      "id": "spec_vaccination",
      "name": "Vaccination & Immunization",
      "description": "Preventive care through vaccines",
      "icon": "💉",
      "category": "preventive",
      "helpsWithProblems": [
        {
          "id": "prob_health_checkup",
          "name": "Health Checkup",
          "icon": "🏥"
        }
      ]
    }
  ]
}
```

---

## Frontend Component Props

### DynamicVendorOnboardingForm
```typescript
interface DynamicVendorOnboardingFormProps {
  roleId: string;                          // Required: Role configuration ID
  onSubmit: (data: any) => void;          // Submit handler
  onBack?: () => void;                    // Back navigation handler
  serviceStyles?: string[];               // Available service styles
  
  // ✅ NEW: Edit Mode Support
  initialData?: {                         // Pre-fill data for editing
    formData: Record<string, any>;
    specializations: string[];
    location: { lat: number; lng: number };
    documents: any[];
  };
  vendorId?: string;                      // For update operations
  isEditMode?: boolean;                   // Flag to enable edit mode
}
```

---

## Usage Examples

### 1. Create New Profile
```tsx
<DynamicVendorOnboardingForm
  roleId="role_clinic_001"
  onSubmit={handleSubmit}
  onBack={() => navigate(-1)}
  serviceStyles={['at_center', 'home_service', 'both']}
/>
```

### 2. Edit Existing Profile
```tsx
<DynamicVendorOnboardingForm
  roleId="role_clinic_001"
  vendorId="vendor_9876543210"
  isEditMode={true}
  initialData={{
    formData: existingVendor.formData,
    specializations: existingVendor.specializations,
    location: existingVendor.location,
    documents: existingVendor.documents
  }}
  onSubmit={handleUpdate}
  onBack={() => navigate(-1)}
/>
```

---

## Database Query Patterns

### Find Vendor by Phone
```typescript
const cleanPhone = normalizePhone(phone);
const allVendors = await kv.getByPrefix('vendor:vendor_');
const vendor = allVendors.find(v => 
  v.phone && normalizePhone(v.phone) === cleanPhone
);
```

### Find Vendors by Specialization
```typescript
const specializationVendors = await kv.get(`vendor:by_specialization:${specId}`) || [];
const vendors = await Promise.all(
  specializationVendors.map(vid => kv.get(`vendor:${vid}`))
);
```

### Find Pending Approvals
```typescript
const pendingIds = await kv.get('vendor:pending_approvals') || [];
const pendingVendors = await Promise.all(
  pendingIds.map(id => kv.get(`vendor:${id}`))
);
```

---

## Performance Optimization

### 1. Indexes to Create
- Phone number normalization index
- Specialization reverse index (spec → vendors)
- Role-based grouping (role → vendors)
- Status-based filtering (status → vendors)
- Location-based search (pincode/city → vendors)

### 2. Caching Strategy
- Cache frequently accessed vendor profiles (15 min TTL)
- Cache specialization lists (1 hour TTL)
- Cache role configurations (until deployment)

### 3. Batch Operations
- Load multiple vendors in parallel using Promise.all
- Batch specialization lookups for search results
- Prefetch related data (documents, staff) when needed

---

## Security & Validation

### 1. Required Validations
- ✅ Duplicate phone number check
- ✅ Email format validation
- ✅ Document upload size limits (5MB per file)
- ✅ Terms agreement required
- ✅ At least one specialization for multi-service centers

### 2. Data Sanitization
- Normalize phone numbers (remove spaces, dashes)
- Trim whitespace from text fields
- Validate coordinates are within valid ranges
- Sanitize file names before storage

### 3. Access Control
- Only approved vendors can edit their profile
- Admins can edit any vendor profile
- Rejected vendors can reapply (create new application)

---

## Migration Notes

### Existing Vendors
If upgrading existing vendors to include specializations:
```typescript
const allVendors = await kv.getByPrefix('vendor:vendor_');
for (const vendor of allVendors) {
  if (!vendor.specializations) {
    vendor.specializations = [];
    vendor.lastProfileUpdate = new Date().toISOString();
    await kv.set(`vendor:${vendor.id}`, vendor);
  }
}
```

---

## Testing Checklist

- [ ] Create new vendor profile with specializations
- [ ] Edit existing vendor profile
- [ ] Save changes without losing data
- [ ] Specialization selection persists
- [ ] Location pin saves correctly
- [ ] Documents upload and display
- [ ] Phone number validation works
- [ ] Duplicate prevention works
- [ ] Reapplication flow works for rejected vendors
- [ ] Admin can approve/reject applications
- [ ] Profile appears in customer search after approval

---

## Related Files

### Frontend
- `/components/vendor/DynamicVendorOnboardingForm.tsx` - Main form with CRUD
- `/components/vendor/onboarding/EnhancedVendorOnboarding.tsx` - Wrapper component
- `/components/vendor/StaffManagement.tsx` - Staff specialization selection

### Backend
- `/supabase/functions/server/vendor-onboarding.tsx` - CRUD endpoints
- `/supabase/functions/server/problem-grid-specialization-system.tsx` - Specialization data
- `/supabase/functions/server/kv_store.tsx` - KV store operations (READ ONLY)

---

## Future Enhancements

1. **Version Control**: Track profile changes with full history
2. **Approval Workflow**: Multi-step approval with reviewer comments
3. **Bulk Import**: CSV/Excel import for multiple vendors
4. **Advanced Search**: Full-text search across vendor profiles
5. **Analytics**: Track onboarding completion rates
6. **Auto-save**: Draft mode with periodic saves
7. **Conflict Resolution**: Handle concurrent edits

---

**Last Updated**: December 18, 2024
**Author**: Warmpawz Development Team
**Status**: ✅ Production Ready
