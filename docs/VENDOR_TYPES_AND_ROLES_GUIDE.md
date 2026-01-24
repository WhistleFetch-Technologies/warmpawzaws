# Vendor Types, Roles, and Service Styles - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Vendor Types](#vendor-types)
3. [Role Structure](#role-structure)
4. [Service Styles](#service-styles)
5. [Behavior Matrix](#behavior-matrix)
6. [Role Naming Conventions](#role-naming-conventions)
7. [Service Discovery Rules](#service-discovery-rules)
8. [Configuration Examples](#configuration-examples)

---

## Overview

The Warmpawz platform distinguishes between **Solo Vendors** (individual providers) and **Business Vendors** (organizations/clinics). This distinction affects how vendors appear in search results, what services they can offer, and how customers interact with them.

---

## Vendor Types

### 1. Solo Vendors (Individual Providers)

**Definition:** Individual service providers who work independently, not as part of an organization.

**Characteristics:**
- Work independently (no staff members)
- Typically operate from home or mobile
- Direct customer interaction
- Personal branding
- Examples: Individual veterinarians, home groomers, dog walkers

**Role Naming Pattern:** `{service}_solo`
- `vet_solo` - Solo Veterinarian
- `grooming_solo` - Solo Pet Groomer
- `training_solo` - Solo Pet Trainer
- `walker_solo` - Solo Dog Walker
- `nutritionist_solo` - Solo Pet Nutritionist
- `behaviourist_solo` - Solo Pet Behaviourist
- `sitter_solo` - Solo Pet Sitter
- `diagnostics_solo` - Solo Diagnostics Provider

**Database Fields:**
- `vendor_type = 'solo'`
- `role.name` ends with `_solo`
- No staff members associated
- `is_individual_provider = true` (in staff table if applicable)

---

### 2. Business Vendors (Organizations/Clinics)

**Definition:** Business entities, clinics, centers, or organizations that may have multiple staff members.

**Characteristics:**
- Business/organizational structure
- May have multiple staff members
- Physical location (clinic, center, salon)
- Business branding
- Examples: Veterinary clinics, grooming salons, training centers

**Role Naming Patterns:**
- `vet_clinic` - Veterinary Clinic
- `veterinarian` - General Veterinarian (business)
- `grooming_salon` - Grooming Salon
- `pet_groomer` - Pet Grooming Business
- `pet_trainer` - Training Center
- `boarding_resort` - Boarding Facility
- `pet_store` - Pet Store

**Database Fields:**
- `vendor_type = 'business'` or `'organization'`
- `role.name` does NOT end with `_solo`
- May have staff members
- `business_name` field populated

---

## Role Structure

### Role Configuration Schema

Each role has a `config` JSONB field with the following structure:

```json
{
  "category": "healthcare|service|retail|general",
  "vendorTypes": ["solo", "business"],
  "serviceStyles": {
    "solo": ["at_home", "tele"],
    "business": ["at_center", "at_home", "tele"],
    "selected": ["at_home", "tele"]
  },
  "customer_service": "vet|grooming|training|...",
  "vendorConfiguration": "solo|business"
}
```

### Complete Role List

#### Healthcare Roles

| Role Name | Display Name | Type | Service Styles |
|-----------|--------------|------|----------------|
| `vet_solo` | Veterinarian (Solo) | Solo | `at_home`, `tele` |
| `vet_clinic` | Veterinary Clinic | Business | `at_center`, `at_home`, `tele` |
| `veterinarian` | Veterinarian | Business | `at_center`, `at_home`, `tele` |
| `vet` | Vet | Generic | All styles |

#### Grooming Roles

| Role Name | Display Name | Type | Service Styles |
|-----------|--------------|------|----------------|
| `grooming_solo` | Pet Groomer (Solo) | Solo | `at_home`, `tele` |
| `grooming_salon` | Grooming Salon | Business | `at_center`, `at_home`, `tele` |
| `pet_groomer` | Pet Groomer | Business | `at_center`, `at_home`, `tele` |
| `groomer` | Groomer | Generic | All styles |

#### Training Roles

| Role Name | Display Name | Type | Service Styles |
|-----------|--------------|------|----------------|
| `training_solo` | Pet Trainer (Solo) | Solo | `at_home`, `tele` |
| `pet_trainer` | Pet Trainer | Business | `at_center`, `at_home`, `tele` |
| `trainer` | Trainer | Generic | All styles |

#### Walking Roles

| Role Name | Display Name | Type | Service Styles |
|-----------|--------------|------|----------------|
| `walker_solo` | Dog Walker (Solo) | Solo | `at_home` |
| `dog_walker` | Dog Walker | Business | `at_home` |
| `pet_walker` | Pet Walker | Business | `at_home` |
| `walker` | Walker | Generic | `at_home` |

#### Other Service Roles

| Role Name | Display Name | Type | Service Styles |
|-----------|--------------|------|----------------|
| `nutritionist_solo` | Pet Nutritionist (Solo) | Solo | `tele`, `at_home` |
| `pet_nutritionist` | Pet Nutritionist | Business | `tele`, `at_home` |
| `behaviourist_solo` | Pet Behaviourist (Solo) | Solo | `at_home`, `tele` |
| `pet_behaviourist` | Pet Behaviourist | Business | `at_home`, `tele` |
| `sitter_solo` | Pet Sitter (Solo) | Solo | `at_home` |
| `pet_sitter` | Pet Sitter | Business | `at_home` |
| `diagnostics_solo` | Diagnostics Provider (Solo) | Solo | `at_center`, `at_home` |
| `diagnostics_provider` | Diagnostics Provider | Business | `at_center`, `at_home` |

---

## Service Styles

### 1. `at_center` (Clinic/Center Visit)

**Definition:** Services provided at the vendor's physical location (clinic, salon, center).

**Characteristics:**
- Customer visits vendor's location
- Physical facility required
- Business/organization model
- Examples: Clinic visits, salon grooming, training center sessions

**Who Can Offer:**
- ✅ Business vendors only (clinics, salons, centers)
- ❌ Solo vendors CANNOT offer `at_center` services

**Search Behavior:**
- Returns business vendors only
- Excludes all `*_solo` roles
- Filters: `r.name NOT LIKE '%_solo'`

---

### 2. `at_home` (Home Visit)

**Definition:** Services provided at the customer's location (home visit).

**Characteristics:**
- Vendor travels to customer
- Mobile service
- Can track live location
- Examples: Home vet visits, mobile grooming, home training

**Who Can Offer:**
- ✅ Solo vendors (individual providers)
- ✅ Business vendors (via staff members or directly)

**Search Behavior:**
- Returns both solo vendors and business vendors
- Includes all role types
- May show staff members from clinics

---

### 3. `tele` (Tele Consultation)

**Definition:** Remote services via video/phone call.

**Characteristics:**
- No physical location required
- Video/phone consultation
- Digital prescriptions
- 24/7 availability possible
- Examples: Video vet consultation, tele-grooming advice

**Who Can Offer:**
- ✅ Solo vendors (individual providers)
- ✅ Business vendors (via staff members or directly)

**Search Behavior:**
- Returns both solo vendors and business vendors
- Includes all role types
- May show staff members from clinics
- Platform-level services available

---

## Behavior Matrix

### Service Discovery by Service Style

| Service Style | Solo Vendors | Business Vendors | Staff Members | Notes |
|---------------|--------------|------------------|---------------|-------|
| `at_center` | ❌ Excluded | ✅ Included | ✅ Included | Only organizations |
| `at_home` | ✅ Included | ✅ Included | ✅ Included | All types allowed |
| `tele` | ✅ Included | ✅ Included | ✅ Included | All types allowed |

### Role Filtering by Service Style

#### For `at_center` (Clinic) Searches:

**Excluded Roles:**
- `vet_solo`
- `grooming_solo`
- `training_solo`
- `walker_solo`
- `nutritionist_solo`
- `behaviourist_solo`
- `sitter_solo`
- `diagnostics_solo`
- Any role ending with `_solo`

**Included Roles:**
- `vet_clinic`
- `veterinarian`
- `grooming_salon`
- `pet_groomer`
- `pet_trainer`
- `boarding_resort`
- All business/organization roles

**SQL Filter:**
```sql
AND (r.name IS NULL OR r.name NOT LIKE '%_solo')
```

#### For `at_home` and `tele` Searches:

**Included Roles:**
- All solo roles (`*_solo`)
- All business roles
- All generic roles

**No exclusions** - both solo and business vendors appear.

---

## Role Naming Conventions

### Pattern Recognition

1. **Solo Vendors:** `{service}_solo`
   - Pattern: Ends with `_solo`
   - Example: `vet_solo`, `grooming_solo`

2. **Business Vendors:** `{service}_clinic`, `{service}_salon`, `pet_{service}`, or generic
   - Pattern: Does NOT end with `_solo`
   - Examples: `vet_clinic`, `grooming_salon`, `pet_groomer`

3. **Generic Roles:** Single word
   - Examples: `vet`, `groomer`, `trainer`, `walker`

### Category Role Mapping

The system uses category-to-role mappings for search:

```typescript
const categoryRoles = {
  'vet': ['Veterinarian', 'veterinarian', 'vet', 'vet_clinic', 'vet_solo'],
  'grooming': ['Groomer', 'groomer', 'pet_groomer', 'grooming_salon', 'grooming_solo'],
  'training': ['Trainer', 'trainer', 'pet_trainer', 'training_solo'],
  'walker': ['Walker', 'walker', 'pet_walker', 'dog_walker', 'walker_solo'],
  'nutritionist': ['nutritionist', 'pet_nutritionist', 'nutritionist_solo'],
  'behaviourist': ['behaviourist', 'pet_behaviourist', 'behaviourist_solo'],
  'sitting': ['pet_sitter', 'sitter', 'sitter_solo'],
  'diagnostics': ['diagnostics_provider', 'diagnostics_solo'],
};
```

**For `at_center` searches:** Solo roles are removed from these mappings.

---

## Service Discovery Rules

### Endpoint: `GET /customer/services/by-style`

#### Parameters:
- `style`: `tele` | `at_home` | `at_center`
- `category`: `vet` | `grooming` | `training` | etc.
- `roleId`: Specific role ID or name

#### Query Logic:

**1. For `at_center` (Clinic) Services:**

```sql
SELECT vendors
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
INNER JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.status = 'approved'
  AND v.is_active = true
  AND vs.service_style = 'at_center'
  AND vs.is_enabled = true
  AND vs.publish_status IN ('published', 'draft')
  AND (r.name IS NULL OR r.name NOT LIKE '%_solo')  -- Exclude solo vendors
```

**2. For `at_home` and `tele` Services:**

**Step 1: Individual Providers (Solo Vendors)**
```sql
SELECT staff
FROM staff s
WHERE s.is_active = true
  AND s.mobile_verified = true
  AND s.vendor_id IS NULL
  AND s.is_individual_provider = true
  AND EXISTS (
    SELECT 1 FROM vendor_services vs
    WHERE vs.vendor_id = s.vendor_id
      AND vs.service_style IN ('at_home', 'tele')
      AND vs.is_enabled = true
      AND vs.publish_status IN ('published', 'draft')
  )
```

**Step 2: Verified Staff from Clinics**
```sql
SELECT staff
FROM staff s
INNER JOIN vendors v ON s.vendor_id = v.id
WHERE s.is_active = true
  AND s.mobile_verified = true
  AND v.status = 'approved'
  AND v.is_active = true
  AND EXISTS (
    SELECT 1 FROM vendor_services vs
    WHERE vs.vendor_id = v.id
      AND vs.service_style IN ('at_home', 'tele')
      AND vs.is_enabled = true
      AND vs.publish_status IN ('published', 'draft')
  )
```

**Step 3: Vendor Fallback (Direct Vendor Services)**
```sql
SELECT vendors
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
INNER JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.status = 'approved'
  AND v.is_active = true
  AND vs.service_style IN ('at_home', 'tele')
  AND vs.is_enabled = true
  AND vs.publish_status IN ('published', 'draft')
  -- No solo exclusion - both solo and business included
```

---

## Configuration Examples

### Example 1: Solo Veterinarian Role

```json
{
  "id": "072548c8-84a9-4165-a9ec-0387c8c76a0e",
  "name": "vet_solo",
  "display_name": "Veterinarian (Solo)",
  "config": {
    "category": "healthcare",
    "vendorTypes": ["solo"],
    "serviceStyles": {
      "solo": ["at_home", "tele"],
      "business": [],
      "selected": ["at_home", "tele"]
    },
    "customer_service": "vet",
    "vendorConfiguration": "solo"
  }
}
```

**Behavior:**
- ✅ Appears in `at_home` searches
- ✅ Appears in `tele` searches
- ❌ Does NOT appear in `at_center` searches
- Can offer: Home visits, tele consultations
- Cannot offer: Clinic visits

---

### Example 2: Veterinary Clinic Role

```json
{
  "id": "abc123-def456-...",
  "name": "vet_clinic",
  "display_name": "Veterinary Clinic",
  "config": {
    "category": "healthcare",
    "vendorTypes": ["business"],
    "serviceStyles": {
      "solo": [],
      "business": ["at_center", "at_home", "tele"],
      "selected": ["at_center", "at_home", "tele"]
    },
    "customer_service": "vet",
    "vendorConfiguration": "business"
  }
}
```

**Behavior:**
- ✅ Appears in `at_center` searches
- ✅ Appears in `at_home` searches (via staff)
- ✅ Appears in `tele` searches (via staff)
- Can offer: All service styles
- May have staff members

---

### Example 3: Vendor Service Configuration

```json
{
  "vendor": {
    "id": "35dd312a-d982-4ed8-a3dd-a2700084e379",
    "vendor_type": "solo",
    "role_id": "072548c8-84a9-4165-a9ec-0387c8c76a0e",
    "role": {
      "name": "vet_solo",
      "display_name": "Veterinarian (Solo)"
    }
  },
  "services": {
    "tele": {
      "services": [
        {
          "serviceName": "Tele-Consultation",
          "serviceStyle": "tele",
          "price": 300,
          "duration": 20,
          "publishStatus": "draft"
        }
      ]
    },
    "at_home": {
      "services": []
    },
    "at_center": {
      "services": []
    }
  }
}
```

**Search Results:**
- ✅ Appears in: `/customer/services/by-style?style=tele&category=vet`
- ✅ Appears in: `/customer/services/by-style?style=at_home&category=vet`
- ❌ Does NOT appear in: `/customer/services/by-style?style=at_center&category=vet`

---

## Key Business Rules

### Rule 1: Solo Vendors Cannot Offer Clinic Services
- Solo vendors (`*_solo` roles) are **automatically excluded** from `at_center` search results
- This is enforced at the database query level
- Solo vendors can only offer `at_home` and `tele` services

### Rule 2: Business Vendors Can Offer All Service Styles
- Business vendors can offer `at_center`, `at_home`, and `tele` services
- They may have staff members who provide services
- Staff members must be `mobile_verified = true` to appear in `at_home`/`tele` searches

### Rule 3: Draft Services Are Included
- Services with `publish_status = 'draft'` are included in search results (if `is_enabled = true`)
- This allows vendors to test services before publishing
- Both `published` and `draft` services appear in customer searches

### Rule 4: Role Matching is Flexible
- When searching by `category` and `roleId`, the system:
  1. Looks up the role in the database
  2. Adds common variations based on category
  3. Includes both solo and business roles (except for `at_center`)
  4. Matches by role name, role ID, or display name

---

## Database Schema Reference

### Vendors Table
```sql
vendors (
  id UUID PRIMARY KEY,
  business_name TEXT,
  owner_name TEXT,
  vendor_type TEXT, -- 'solo' | 'business' | 'organization'
  role_id UUID REFERENCES roles(id),
  status TEXT, -- 'approved' | 'pending' | 'rejected'
  is_active BOOLEAN,
  ...
)
```

### Roles Table
```sql
roles (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE, -- 'vet_solo', 'vet_clinic', etc.
  display_name TEXT,
  config JSONB, -- Contains serviceStyles, vendorTypes, etc.
  is_active BOOLEAN,
  ...
)
```

### Vendor Services Table
```sql
vendor_services (
  id UUID PRIMARY KEY,
  vendor_id UUID REFERENCES vendors(id),
  service_id UUID,
  service_name TEXT,
  service_style TEXT, -- 'at_center' | 'at_home' | 'tele'
  price DECIMAL,
  duration_minutes INTEGER,
  is_enabled BOOLEAN,
  publish_status TEXT, -- 'published' | 'draft'
  ...
)
```

### Staff Table
```sql
staff (
  id UUID PRIMARY KEY,
  vendor_id UUID REFERENCES vendors(id), -- NULL for solo providers
  name TEXT,
  role TEXT,
  is_individual_provider BOOLEAN,
  mobile_verified BOOLEAN,
  is_active BOOLEAN,
  ...
)
```

---

## API Endpoints Reference

### 1. Get Services by Style
```
GET /customer/services/by-style?style={style}&category={category}&roleId={roleId}
```

**Response Structure:**
```json
{
  "success": true,
  "style": "tele",
  "providers": [
    {
      "providerId": "...",
      "providerType": "vendor" | "staff" | "individual",
      "vendorId": "...",
      "name": "...",
      "services": [...]
    }
  ],
  "total": 1,
  "vendors": [...] // Backward compatibility
}
```

### 2. Get Vendor Services
```
GET /vendor/{vendorId}/services
```

**Response Structure:**
```json
{
  "success": true,
  "services": {
    "at_center": { "services": [], "count": 0 },
    "at_home": { "services": [], "count": 0 },
    "tele": { "services": [...], "count": 1 }
  },
  "vendor": {
    "id": "...",
    "role_id": "...",
    "vendor_type": "solo"
  },
  "role": {
    "name": "vet_solo",
    "config": { ... }
  }
}
```

---

## Troubleshooting

### Issue: Solo vendor not appearing in tele/at_home search

**Check:**
1. ✅ Service `is_enabled = true`
2. ✅ Service `publish_status IN ('published', 'draft')`
3. ✅ Service `service_style` matches search parameter
4. ✅ Vendor `status = 'approved'`
5. ✅ Vendor `is_active = true`
6. ✅ Role name matches category mapping

### Issue: Solo vendor appearing in at_center search

**This should NOT happen!** Check:
1. Query filter: `r.name NOT LIKE '%_solo'` is applied
2. Category role mapping excludes solo roles for `at_center`
3. Vendor's role name ends with `_solo`

### Issue: Business vendor not appearing

**Check:**
1. ✅ Vendor has services with matching `service_style`
2. ✅ Services are `is_enabled = true`
3. ✅ Services are `publish_status IN ('published', 'draft')`
4. ✅ For `at_center`: Role name does NOT end with `_solo`
5. ✅ Vendor `status = 'approved'` and `is_active = true`

---

## Summary

| Aspect | Solo Vendors | Business Vendors |
|--------|--------------|------------------|
| **Role Pattern** | `*_solo` | `*_clinic`, `*_salon`, `pet_*` |
| **Vendor Type** | `solo` | `business` or `organization` |
| **at_center** | ❌ Cannot offer | ✅ Can offer |
| **at_home** | ✅ Can offer | ✅ Can offer |
| **tele** | ✅ Can offer | ✅ Can offer |
| **Staff Members** | ❌ No staff | ✅ May have staff |
| **Search Visibility** | Excluded from clinic searches | Visible in all searches |

---

**Last Updated:** 2026-01-23  
**Version:** 1.0  
**Author:** System Documentation
