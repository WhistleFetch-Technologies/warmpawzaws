# Roles Configuration Guide
## CPO Perspective: Configuration-Based Role System

**Date:** 2026-01-13  
**Status:** ✅ **FULLY CONFIGURATION-BASED**

---

## 🎯 Overview

The Warmpawz platform uses a **100% configuration-based role system**. New roles can be introduced **without any code changes** - just configuration.

---

## 📋 Role Structure

### Database Schema

**Table: `roles`**
```sql
- id: UUID (primary key)
- name: TEXT (unique, e.g., 'veterinarian', 'pet_cafe')
- display_name: TEXT (e.g., 'Veterinarian', 'Pet Cafe')
- description: TEXT
- is_system_role: BOOLEAN (default: false)
- is_active: BOOLEAN (default: true)
- config: JSONB (stores all role configuration)
- created_at, updated_at: TIMESTAMPTZ
```

**Table: `role_permissions`**
```sql
- id: UUID (primary key)
- role_id: UUID (references roles.id)
- permission_name: TEXT (capability name, e.g., 'meal_plans', 'table_management')
- resource: TEXT (default: '*')
- action: TEXT (default: '*')
```

---

## 🔧 Configuration Structure

### Role Config JSONB Format

```json
{
  "category": "healthcare" | "service_provider" | "hospitality" | "general",
  "icon": "🩺" | "☕" | "✂️" | etc.,
  "vendorTypes": ["healthcare_provider"] | ["service_provider"] | ["solo", "business"],
  "serviceStyles": ["at_clinic", "video_consultation", "home_visit"] | ["at_center"] | etc.,
  "pricingControl": {
    "canControlPrice": true | false,
    "canControlDuration": true | false
  },
  "onboardingFields": { /* optional: form schema */ }
}
```

---

## 📦 All 45 Capabilities

### Core Operations (6)
1. `dashboard` - Dashboard overview
2. `bookings` - Manage appointments
3. `services` - Manage services catalog
4. `staff` - Manage team members
5. `schedule` - Manage availability
6. `profile` - Update vendor profile

### Finance & Payments (4)
7. `earnings` - View earnings
8. `settlements` - View payouts
9. `bank_account` - Manage bank details
10. `pricing` - Manage service pricing

### Communication (3)
11. `chat` - Messages/Chat
12. `notifications` - Notifications
13. `video_calling` - Video consultations

### Healthcare (4)
14. `prescriptions` - Create prescriptions
15. `medical_records` - Medical records
16. `diagnostics` - Diagnostic tests
17. `pharmacy` - Pharmacy management

### Specialized Services (8+)
18. `ambulance` - Ambulance services
19. `cafe_tables` - Cafe table management
20. `table_management` - Table management (detailed)
21. `rooms` - Resort/boarding rooms
22. `room_management` - Room management (detailed)
23. `insurance_plans` - Insurance plans
24. `pet_profiles` - Pet profiles for adoption
25. `meal_plans` - Meal plans (Nutritionist)
26. `training_programs` - Training programs
27. `walking` - Walking services

### Operations (6)
28. `inventory` - Inventory management
29. `orders` - Order management
30. `delivery` - Delivery tracking
31. `gps_tracking` - GPS tracking
32. `reports` - Reports and analytics
33. `settings` - Vendor settings

### Advanced Features (8)
34. `packages` - Package management
35. `subscriptions` - Subscription management
36. `coupons` - Coupon management
37. `promotions` - Promotions
38. `reviews` - Review management
39. `analytics` - Analytics dashboard
40. `export` - Data export
41. `integrations` - Third-party integrations

### Additional Specialized (20+)
- `tele` - Tele consultation
- `emergency` - Emergency services
- `emergency_protocols` - Emergency protocols
- `ambulance_services` - Ambulance services
- `diagnostic_lab` - Diagnostic lab
- `patient_monitoring` - Patient monitoring
- `vet_summary` - Vet summary
- `prescription_verification` - Prescription verification
- `controlled_substances` - Controlled substances
- `catalog` - Product catalog
- `expiry_management` - Expiry management
- `photo_updates` - Photo updates
- `gallery` - Gallery
- `portfolio` - Portfolio
- `progress_tracking` - Progress tracking
- `cctv_access` - CCTV access
- `distance_pricing` - Distance pricing
- `staff_management` - Staff management
- `schedule_management` - Schedule management
- `facility_management` - Facility management
- `multi_doctor_management` - Multi-doctor management
- `custom_services` - Custom services
- `package_management` - Package management
- `pax_management` - PAX management
- `occupancy_tracking` - Occupancy tracking
- `nightly_pricing` - Nightly pricing
- `menu` - Menu management
- `diet_charts` - Diet charts
- `counseling` - Counseling
- `adoption` - Adoption
- `donation` - Donation
- `events` - Events
- `memorial` - Memorial
- `claims_management` - Claims management
- `policy_management` - Policy management

**Total: 45+ capabilities available**

---

## 🚀 Creating a New Role (Configuration-Only)

### Step 1: Create Role via API

```bash
POST /admin/roles
{
  "name": "pet_spa",
  "display_name": "Pet Spa",
  "description": "Pet spa and wellness services",
  "category": "service_provider",
  "icon": "💆",
  "vendorTypes": ["service_provider"],
  "serviceStyles": ["at_center", "at_home"],
  "pricingControl": {
    "canControlPrice": true,
    "canControlDuration": true
  },
  "capabilities": [
    "bookings",
    "services",
    "schedule",
    "staff_management",
    "facility_management",
    "custom_services",
    "package_management",
    "gallery",
    "portfolio"
  ],
  "is_active": true
}
```

### Step 2: Role is Automatically Available

- ✅ Appears in role selection during vendor onboarding
- ✅ Capabilities are enforced automatically
- ✅ Service catalog filters by role
- ✅ UI adapts based on capabilities
- ✅ No code changes needed!

---

## 🎨 Example Role Configurations

### Veterinarian
```json
{
  "category": "healthcare",
  "icon": "🩺",
  "vendorTypes": ["healthcare_provider"],
  "serviceStyles": ["at_clinic", "video_consultation", "home_visit"],
  "pricingControl": {
    "canControlPrice": true,
    "canControlDuration": true
  },
  "capabilities": [
    "prescription",
    "medical_records",
    "booking",
    "chat",
    "staff_management",
    "tele",
    "emergency",
    "facility_management",
    "schedule_management",
    "custom_services",
    "package_management",
    "vet_summary",
    "patient_monitoring"
  ]
}
```

### Pet Cafe
```json
{
  "category": "hospitality",
  "icon": "☕",
  "vendorTypes": ["service_provider"],
  "serviceStyles": ["at_center"],
  "pricingControl": {
    "canControlPrice": true,
    "canControlDuration": false
  },
  "capabilities": [
    "booking",
    "menu",
    "events",
    "staff_management",
    "facility_management",
    "schedule_management",
    "custom_services",
    "package_management",
    "table_management",
    "pax_management",
    "occupancy_tracking",
    "chat"
  ]
}
```

### Nutritionist
```json
{
  "category": "healthcare",
  "icon": "🥗",
  "vendorTypes": ["healthcare_provider"],
  "serviceStyles": ["at_clinic", "video_consultation", "home_visit"],
  "pricingControl": {
    "canControlPrice": true,
    "canControlDuration": true
  },
  "capabilities": [
    "booking",
    "prescription",
    "meal_plans",
    "diet_charts",
    "counseling",
    "chat",
    "schedule_management",
    "custom_services",
    "package_management"
  ]
}
```

---

## ✅ Key Features

1. **100% Configuration-Based**: No code changes needed for new roles
2. **All 45+ Capabilities Available**: Every capability can be assigned to any role
3. **Flexible Service Styles**: Support for at_clinic, at_home, video_consultation, etc.
4. **Vendor Type Support**: healthcare_provider, service_provider, seller, ngo, etc.
5. **Pricing Control**: Granular control over price and duration settings
6. **Dynamic UI**: UI adapts based on assigned capabilities
7. **Automatic Enforcement**: Capabilities are enforced at API level

---

## 🔍 API Endpoints

- `GET /admin/roles` - List all roles
- `GET /admin/roles/:id` - Get role details
- `POST /admin/roles` - Create new role (configuration-only)
- `PUT /admin/roles/:id` - Update role configuration
- `DELETE /admin/roles/:id` - Soft delete role (sets is_active = false)
- `GET /admin/capabilities` - List all 45+ capabilities

---

## 📝 Best Practices

1. **Use Descriptive Names**: `pet_spa` not `spa1`
2. **Select Relevant Capabilities**: Only assign capabilities the role actually needs
3. **Set Appropriate Vendor Types**: Match the business model
4. **Configure Service Styles**: Match how services are delivered
5. **Test Before Activating**: Create role with `is_active: false`, test, then activate

---

## 🎯 CPO Checklist for New Role

- [ ] Define role name and display name
- [ ] Select appropriate category
- [ ] Choose icon (emoji)
- [ ] Define vendor types (solo, business, healthcare_provider, etc.)
- [ ] Define service styles (at_clinic, at_home, video_consultation, etc.)
- [ ] Set pricing control permissions
- [ ] Select relevant capabilities from 45+ available
- [ ] Create role via API
- [ ] Test role in vendor onboarding flow
- [ ] Verify capabilities are enforced
- [ ] Activate role (`is_active: true`)

---

**Last Updated:** 2026-01-13  
**Status:** ✅ Production Ready
