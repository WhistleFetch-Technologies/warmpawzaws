# 🏥 Staff Service Style Setup Guide

## Overview

The Warmpawz platform implements a comprehensive **3-tier service style framework**:

1. **At Home (🏠)** - Staff travel to customer's location
2. **At Center (🏥)** - Customers visit the vendor's facility  
3. **Tele (📹)** - Remote video/chat consultations

This guide explains how to initialize and manage staff service style preferences.

---

## Quick Start

### Step 1: Seed Vendors (if not already done)

The system needs vendors first. If you haven't seeded vendors yet:

1. Open the app
2. Navigate to **Admin Portal**
3. Look for the seed vendors option, or call the endpoint directly:

```bash
POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/seed-vendors
```

This creates ~45 vendors across all roles (veterinarian, groomer, trainer, walker, etc.)

### Step 2: Initialize Staff Service Styles

**Option A: Using the UI (Recommended)**

1. Open the app
2. Click on **🏥 Style Setup** button in the top navigation
3. Review the current system status
4. Click **▶️ Run Staff Service Style Setup**
5. Wait for completion (should take ~5-10 seconds)
6. Review the results

**Option B: Using API**

```bash
POST https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/setup-staff-service-styles
Authorization: Bearer {publicAnonKey}
```

---

## What the Setup Does

The setup script performs the following actions:

### 1. Staff Creation
- Finds all **approved vendors**
- Creates a staff member for each vendor (vendor owner becomes default staff)
- Inherits vendor's location, experience, and role information

### 2. Style Preferences Configuration

Based on the vendor's `serviceStyles` field, the script creates preferences:

```typescript
{
  at_center: {
    enabled: true/false,
    available: true/false
  },
  at_home: {
    enabled: true/false,
    available: true/false,
    maxDistance: 10,           // 10 km radius
    travelChargePerKm: 20,     // ₹20 per km
    acceptInstantBooking: true
  },
  tele: {
    enabled: true/false,
    available: true/false,
    videoEnabled: true,
    chatEnabled: true,
    maxSessionDuration: 45,    // 45 minutes
    acceptInstantBooking: false
  },
  autoAcceptBookings: false
}
```

### 3. Sample Services

Creates role-appropriate services with proper `serviceStyle` tags:

**Veterinarian:**
- General Checkup (at_center, at_home, tele)
- Vaccination (at_center, at_home)
- Emergency Consultation (at_center, at_home)

**Pet Groomer:**
- Basic Grooming (at_center, at_home)
- Full Grooming Package (at_center, at_home)

**Pet Walker:**
- Daily Walk 30min (at_home)
- Extended Walk 60min (at_home)

**Pet Trainer:**
- Basic Obedience Training (at_center, at_home)
- Behavioral Consultation (tele, at_center, at_home)

---

## Service Style Rules

### Home Services (at_home)
✅ **Requires:**
- Staff location (latitude/longitude)
- Customer location for distance calculation
- Police verification (for security)

🔧 **Features:**
- Distance-based filtering (default 10km radius)
- Travel charge calculation
- Live GPS tracking (planned)
- Emergency reassignment (planned)

⚠️ **START/END OTP:**
- **Walkers/Trainers/Behaviourists**: Use START and END OTP
- **All others**: Use only END OTP

### Center Services (at_center)
✅ **Requires:**
- Vendor facility address
- Facility details (optional)

🔧 **Features:**
- Customer visits vendor location
- No distance restrictions
- Facility-based scheduling

### Tele Services (tele)
✅ **Requires:**
- Video calling integration (planned)
- Session duration limits

🔧 **Features:**
- Remote consultations
- Chat support
- Video calls (integration pending)
- No location required

---

## Discovery API

Once setup is complete, customers can discover staff by service style:

```typescript
GET /make-server-3dd53475/customer/discover-staff
  ?roleId=veterinarian
  &serviceStyle=at_home
  &latitude=12.9716
  &longitude=77.5946
  &maxDistance=10
  &serviceId=service_xyz (optional)
```

**Response:**
```json
{
  "success": true,
  "staff": [
    {
      "id": "staff_xxx",
      "fullName": "Dr. Anita Desai",
      "roleType": "veterinarian",
      "rating": 4.5,
      "distance": 2.4,
      "services": [...],
      "stylePreferences": {...}
    }
  ],
  "total": 1,
  "filters": {...}
}
```

---

## Status Monitoring

### Check System Status

```bash
GET /make-server-3dd53475/admin/staff-style-status
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalStaff": 15,
    "withPreferences": 15,
    "withoutPreferences": 0,
    "byStyle": {
      "at_center": 12,
      "at_home": 8,
      "tele": 5
    },
    "byRole": {
      "veterinarian": {
        "total": 3,
        "withPreferences": 3,
        "at_center": 2,
        "at_home": 2,
        "tele": 1
      }
    }
  }
}
```

---

## Manual Configuration

You can manually update staff preferences:

```typescript
// Get current preferences
const prefs = await kv.get(`staff:${staffId}:style_preferences`);

// Update
prefs.at_home.enabled = true;
prefs.at_home.maxDistance = 15; // Increase radius to 15km
prefs.at_home.travelChargePerKm = 30; // ₹30 per km

await kv.set(`staff:${staffId}:style_preferences`, prefs);
```

---

## Troubleshooting

### Issue: "0 staff found" in discovery

**Solution:**
1. Check if vendors are seeded: `GET /vendor/list` (admin)
2. Check if staff exist: Look at KV store for `staff:staff_*`
3. Run the setup script again (it's idempotent)
4. Check staff preferences exist: `staff:{staffId}:style_preferences`

### Issue: Staff discovered but no services

**Solution:**
1. Check if services have `serviceStyle` field set
2. Run the setup script to create sample services
3. Manually create services with proper `serviceStyle` tags

### Issue: Distance filtering not working

**Solution:**
1. Ensure customer location is being passed in the API call
2. Check staff has `lastKnownLocation` or vendor has `location.latitude/longitude`
3. Verify `maxDistance` in staff preferences

---

## Architecture Notes

### Data Structure

```
KV Store Structure:
├── staff:staff_xxx                    # Staff profile
├── staff:staff_xxx:style_preferences  # Service style config
├── staff:staff_xxx:service:service_yyy # Individual service
├── vendor:vendor_zzz                  # Vendor profile
└── vendor:vendor_zzz:staff            # Array of staff IDs
```

### Auto-Enable Logic

The discovery endpoint has auto-enable logic:
- If staff has services with `serviceStyle=at_home` but no preferences
- Auto-creates preferences with that style enabled
- Prevents data inconsistencies

---

## Next Steps

After running the setup:

1. ✅ Test discovery in Customer App → Vet Services → Home Visit
2. ✅ Check if vets appear in the list
3. ✅ Verify distance calculation works
4. 🔧 Implement live GPS tracking for home services
5. 🔧 Implement video calling for tele services
6. 🔧 Implement START/END OTP for walker sessions

---

## Reference

- **Discovery Endpoint:** `/supabase/functions/server/staff-discovery-endpoints.tsx`
- **Setup Script:** `/supabase/functions/server/staff-service-style-setup.tsx`
- **UI Component:** `/StaffServiceStyleSetup.tsx`
- **Customer UI:** `/components/customer/VetAtHome.tsx`

---

**Last Updated:** November 27, 2024
