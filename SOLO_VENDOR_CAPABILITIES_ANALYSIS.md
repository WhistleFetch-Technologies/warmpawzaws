# Solo Vendor Capabilities Analysis
## For Center-Enabled Vendors (at_center service style)

---

## 📋 Overview

A **Solo Vendor** is a vendor operating as a single-person business with the `isSoloProvider: true` flag. When they have **"at_center"** service style enabled, they get specific capabilities and restrictions.

---

## 🏗️ Architecture & Behavior

### Entity Structure
When a solo vendor is onboarded, the system automatically creates:
1. **Vendor Record** (`isSoloProvider: true`)
2. **Virtual Center** (`isVirtualCenter: true`, `isSoloProvider: true`)
3. **Auto-Created Staff** (`isAutoCreated: true`, `isSoloProvider: true`, `isOwner: true`)

All three entities share the **same phone number** for unified login.

### Key Behaviors
- **Service Auto-Sync**: Services added to center are automatically synced to staff profile
- **Dual Mode Access**: Can switch between CENTER mode and STAFF mode in dashboard
- **Service Area**: Uses service area (radius/specific areas) instead of fixed address for privacy
- **Simplified Onboarding**: No GST certificate or shop license required (only PAN + bank account)

---

## 👥 Supported Roles

**Any role can be a solo vendor** - it's a flag, not a role type. Common roles include:

| Role ID | Role Name | Service Styles | Icon |
|---------|-----------|----------------|------|
| `veterinarian` | Veterinarian | `at_clinic`, `video_consultation`, `home_visit` | 🩺 |
| `pet_groomer` | Pet Grooming Salon | `at_center`, `at_home` | ✂️ |
| `pet_trainer` | Pet Trainer | `at_home`, `at_center`, `online` | 🎾 |
| `pet_walker` | Pet Walker | `at_home` | 🦮 |
| `pet_sitter` | Pet Sitter | `at_home` | 🏠 |
| `pet_behaviorist` | Pet Behaviorist | `at_home`, `at_center`, `video_consultation` | 🧠 |
| `pet_boarding` | Pet Boarding / Kennel | `at_center` | 🏨 |
| `pet_resort` | Pet Resort | `at_center` | 🏝️ |
| `pet_taxi` | Pet Taxi | `at_home` | 🚕 |
| `pet_products_store` | Pet Store / Retailer | `delivery`, `pickup` | 🛍️ |
| `pet_pharmacy` | Pet Pharmacy | `delivery`, `pickup` | 💊 |
| `pet_cafe` | Pet Cafe | `at_center` | ☕ |
| `pet_photographer` | Pet Photographer | `at_center`, `at_home`, `outdoor` | 📸 |
| `pet_shelter` | Pet Shelter / NGO | `at_center` | 🏠 |
| `pet_sunset_services` | Pet Sunset Services | `at_center`, `home_visit` | 🌅 |
| `nutritionist` | Pet Nutritionist | `at_center`, `video_consultation`, `home_visit` | 🥗 |
| `insurance` | Insurance Agent | `online`, `at_center` | 🛡️ |

---

## ✅ Capabilities for Solo Vendors with "at_center" Enabled

### Universal Capabilities (All Roles)
These capabilities are available to **all solo vendors** regardless of role:

| Capability | Description | Available in Solo Mode |
|------------|-------------|------------------------|
| `booking` | Accept and manage bookings | ✅ Yes |
| `chat` | Communicate with customers | ✅ Yes |
| `facility_management` | Manage center/facility details | ✅ Yes (Virtual Center) |
| `schedule_management` | Manage operating hours and availability | ✅ Yes |
| `custom_services` | Create custom service offerings | ✅ **Yes** (Only if `serviceStyle === 'at_center'` or `'both'`) |
| `package_management` | Create service packages | ✅ Yes |
| `service_area` | Configure service area (radius/specific areas) | ✅ Yes (Privacy-focused) |

### Role-Specific Capabilities

#### For `veterinarian` (Solo Vet with at_center):
```javascript
capabilities: [
  'prescription',           // ✅ Can write prescriptions
  'medical_records',        // ✅ Manage patient records
  'booking',                // ✅ Accept bookings
  'chat',                   // ✅ Customer communication
  'tele',                   // ✅ Video consultations
  'emergency',              // ✅ Emergency services
  'facility_management',    // ✅ Manage clinic
  'schedule_management',    // ✅ Manage schedule
  'custom_services',        // ✅ Create custom services (at_center enabled)
  'package_management',     // ✅ Create packages
  'vet_summary',            // ✅ Veterinary summaries
  'patient_monitoring'       // ✅ Monitor patients
]
```

#### For `pet_groomer` (Solo Groomer with at_center):
```javascript
capabilities: [
  'booking',                // ✅ Accept bookings
  'portfolio',              // ✅ Showcase work portfolio
  'gallery',                // ✅ Photo gallery
  'chat',                   // ✅ Customer communication
  'facility_management',    // ✅ Manage salon
  'schedule_management',    // ✅ Manage schedule
  'custom_services',        // ✅ Create custom services (at_center enabled)
  'package_management'      // ✅ Create packages
]
```

#### For `pet_boarding` (Solo Boarding with at_center):
```javascript
capabilities: [
  'booking',                // ✅ Accept bookings
  'cctv_access',            // ✅ CCTV monitoring
  'photo_updates',           // ✅ Send photo updates to owners
  'chat',                   // ✅ Customer communication
  'facility_management',    // ✅ Manage facility
  'schedule_management',    // ✅ Manage schedule
  'custom_services',        // ✅ Create custom services (at_center enabled)
  'package_management',     // ✅ Create packages
  'room_management',        // ✅ Manage rooms
  'nightly_pricing',        // ✅ Set nightly rates
  'occupancy_tracking'      // ✅ Track occupancy
]
```

#### For `pet_trainer` (Solo Trainer with at_center):
```javascript
capabilities: [
  'booking',                // ✅ Accept bookings
  'progress_tracking',      // ✅ Track training progress
  'chat',                   // ✅ Customer communication
  'facility_management',    // ✅ Manage training facility
  'schedule_management',    // ✅ Manage schedule
  'custom_services',        // ✅ Create custom services (at_center enabled)
  'package_management'      // ✅ Create packages
]
```

#### For `pet_cafe` (Solo Cafe with at_center):
```javascript
capabilities: [
  'booking',                // ✅ Accept table bookings
  'menu',                   // ✅ Manage menu
  'events',                 // ✅ Host events
  'facility_management',    // ✅ Manage cafe
  'schedule_management',    // ✅ Manage schedule
  'custom_services',        // ✅ Create custom services (at_center enabled)
  'package_management',     // ✅ Create packages
  'table_management',       // ✅ Manage tables
  'pax_management',         // ✅ Manage capacity
  'chat'                    // ✅ Customer communication
]
```

---

## ❌ Solo-Only Restrictions & Limitations

### 1. Staff Management
- **Cannot add staff members** while in solo mode
- Staff management section shows: "Solo Provider Mode - To add staff members, contact support@warmpawz.com"
- Must upgrade to multi-staff to add employees

### 2. Service Style Restrictions
- **Custom Services**: Only available if `serviceStyle === 'at_center'` or `'both'`
- **Blocked for**: `at_home` only or `tele` only vendors
- Error message: "Custom services are only available for center-based vendors"

### 3. Address vs Service Area
- **No fixed address** - uses service area (radius/specific areas) for privacy
- Cannot set physical address until upgraded to multi-staff
- Service area types:
  - `RADIUS`: Circular coverage area (e.g., "Serves 10km radius")
  - `SPECIFIC_AREAS`: List of specific areas/pincodes

### 4. Document Requirements
- **Simplified onboarding**: Only requires PAN + bank account
- **Not required**: GST certificate, shop license, business registration
- Must provide these documents to upgrade to multi-staff

### 5. Multi-Doctor/Staff Features
- **Cannot use**: `multi_doctor_management` capability
- **Cannot use**: Advanced staff scheduling features
- Limited to single-person operations

---

## 🔄 Mode Switching (CENTER ↔ STAFF)

Solo vendors can switch between two modes:

### CENTER Mode
- Manage center-level settings
- Configure service catalog
- Set operating hours
- Configure service area
- View center statistics
- Manage business info

### STAFF Mode
- View personal profile
- Manage availability status
- View active bookings
- GPS tracking (if enabled)
- Today's schedule
- Professional profile editing

**Note**: Services are auto-synced between center and staff, so changes in CENTER mode reflect in STAFF mode.

---

## 🎯 Capability Mapping: Solo-Only Features

### ✅ Available in Solo Mode
| Feature | Description | Notes |
|---------|-------------|-------|
| **Service Auto-Sync** | Center services → Staff services | Automatic, no manual action needed |
| **Dual Mode Dashboard** | Switch between CENTER and STAFF views | Unique to solo providers |
| **Service Area Config** | Privacy-focused location (no fixed address) | Solo-only feature |
| **Simplified Onboarding** | Minimal document requirements | Faster approval process |
| **GPS Tracking** | Track solo provider location | Enabled by default for solo staff |
| **Custom Services** | Create specialized services | **Only if at_center enabled** |
| **Package Management** | Create service packages | Available for all roles |
| **Schedule Management** | Manage availability | Personal schedule only |

### ❌ Not Available in Solo Mode
| Feature | Description | Available After Upgrade |
|---------|-------------|-------------------------|
| **Multi-Staff Management** | Add/manage multiple employees | ✅ After multi-staff upgrade |
| **Fixed Address** | Physical business address | ✅ After multi-staff upgrade |
| **Advanced Staff Scheduling** | Multi-person scheduling | ✅ After multi-staff upgrade |
| **Multi-Doctor Management** | Manage multiple doctors | ✅ After multi-staff upgrade |
| **GST/Shop License** | Business registration documents | ✅ Required for upgrade |

---

## 📊 Capability Matrix by Role (Solo + at_center)

| Capability | Veterinarian | Groomer | Boarding | Trainer | Cafe | Behaviorist |
|------------|--------------|---------|----------|---------|------|-------------|
| `booking` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `chat` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `custom_services` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `package_management` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `facility_management` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `schedule_management` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `prescription` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `medical_records` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `portfolio` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `gallery` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `cctv_access` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `photo_updates` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `progress_tracking` | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| `menu` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `table_management` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `tele` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `emergency` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🚀 Upgrade Path: Solo → Multi-Staff

To upgrade from solo to multi-staff, vendor must:
1. Provide **GST certificate**
2. Provide **shop license**
3. Provide **business registration**
4. Provide **physical address**
5. Contact support or use upgrade endpoint

After upgrade:
- `isSoloProvider` flag set to `false`
- Can add multiple staff members
- Fixed address replaces service area
- Full multi-staff capabilities unlocked

---

## 📝 Summary

**Solo vendors with "at_center" enabled** have:
- ✅ Full access to role-specific capabilities
- ✅ Custom services creation (at_center/both only)
- ✅ Package management
- ✅ Facility and schedule management
- ✅ Dual mode dashboard (CENTER/STAFF)
- ✅ Service auto-sync
- ❌ Cannot add staff (solo-only restriction)
- ❌ No fixed address (uses service area)
- ❌ Simplified document requirements

**Key Insight**: Solo vendors get **most capabilities** of their role, but are **restricted from multi-staff features** until they upgrade. The "at_center" service style enables **custom services** which is a key differentiator for center-based operations.

