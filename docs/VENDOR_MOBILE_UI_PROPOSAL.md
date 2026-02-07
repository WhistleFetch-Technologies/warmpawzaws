# 🐾 Warmpawz Next-Gen Vendor Mobile UI Proposal

## Executive Summary

This document proposes a unified, capability-driven mobile vendor application that:
- **Works for all vendor types** (except Seller Hub which has its own e-commerce dashboard)
- **Shows only relevant features** based on assigned capabilities
- **Uses generic, platform-agnostic labels** (no hardcoded "Doctor" or "Trainer")
- **Supports complete vendor lifecycle** from onboarding to active operations
- **Maintains all existing integrations** (booking, payments, GPS, video calls)

---

## 🎯 Design Principles

### 1. Capability-First Architecture
```
Role → Capabilities → UI Components
```
The database defines what features a vendor sees. The mobile app NEVER hardcodes features.

### 2. Generic Terminology (Platform Labels)
| ❌ Hardcoded | ✅ Generic |
|-------------|-----------|
| Doctor | Provider |
| Patient | Client |
| Clinic | Center |
| Appointment | Booking |
| Consultation | Session |
| Training Session | Service Session |

### 3. Service Style Indicators
Every vendor operates in one or more styles:
- 🏠 **HOME** - Mobile/at-home service
- 🏥 **CENTER** - Physical location
- 📹 **TELE** - Video/phone consultation
- 📦 **RETAIL** - Product delivery/pickup (Seller Hub only)

---

## 📱 Mobile App Architecture

### Screen Structure

```
┌─────────────────────────────────────────┐
│  HEADER (Dynamic based on role)         │
│  - Role Icon + Business Name            │
│  - Online/Offline Toggle                │
│  - Notification Bell                    │
├─────────────────────────────────────────┤
│                                         │
│  DASHBOARD (Capability-driven)          │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Stat 1  │ │ Stat 2  │ │ Stat 3  │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                         │
│  QUICK ACTIONS (From capabilities)      │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐              │
│  │ 📋│ │ 📍│ │ 📦│ │ ⚙️│              │
│  └───┘ └───┘ └───┘ └───┘              │
│                                         │
│  TODAY'S SCHEDULE                       │
│  ┌─────────────────────────────────┐   │
│  │ ● 9:00 AM - Client Name          │   │
│  │   Service Type | Home Visit      │   │
│  └─────────────────────────────────┘   │
│                                         │
├─────────────────────────────────────────┤
│  BOTTOM NAVIGATION (4-5 items max)      │
│  🏠 Home | 📅 Bookings | 💬 Chat | ⚙️  │
└─────────────────────────────────────────┘
```

---

## 🧩 Capability-to-UI Mapping

### Universal Capabilities (All Vendors)

| Capability | UI Component | Screen |
|------------|-------------|--------|
| `dashboard` | Stats + Today's Schedule | Home |
| `profile` | Business Profile Editor | Settings |
| `bookings` | Booking List + Calendar | Bookings Tab |
| `schedule` | Availability Manager | Settings |
| `chat` | In-app Messaging | Chat Tab |
| `earnings` | Revenue Dashboard | Earnings |
| `settlements` | Payout History | Earnings |
| `bank_account` | Bank Details Form | Settings |
| `notifications` | Push + In-app Alerts | Header Bell |

### Service-Specific Capabilities

| Capability | UI Component | Visible To |
|------------|-------------|-----------|
| `gps_tracking` | Live Map Tracker | Walker, Taxi, Ambulance, Relocation |
| `photo_updates` | Photo/Video Uploader | Walker, Sitter, Boarding |
| `facility_management` | Center Settings | All CENTER-based |
| `staff_management` | Staff List + Permissions | All CENTER-based |
| `prescriptions` | Rx Builder | Vet, Clinic, Pharmacy |
| `medical_records` | Pet Health History | Vet, Clinic |
| `gallery` | Photo Portfolio | Groomer, Photographer |
| `cctv_access` | CCTV Viewer | Boarding, Resort |
| `training_programs` | Program Builder | Trainer |
| `meal_plans` | Diet Plan Creator | Nutritionist |
| `menu` | Menu Manager | Cafe |
| `table_management` | Table Layout | Cafe |
| `adoption` | Pet Listing | Shelter |
| `memorial` | Memorial Services | Sunset Services |

---

## 🎨 Dynamic Dashboard Design

### Dashboard Stats Widget (Driven by Role)

```typescript
// Stats are derived from capabilities, not hardcoded
const getDashboardStats = (capabilities: Record<string, boolean>) => {
  const stats = [];
  
  // Universal stats
  if (capabilities.bookings) {
    stats.push({ 
      label: 'Upcoming', 
      icon: 'calendar',
      api: '/bookings/count?status=upcoming'
    });
  }
  
  if (capabilities.earnings) {
    stats.push({
      label: "Today's Revenue",
      icon: 'currency',
      api: '/earnings/today'
    });
  }
  
  // Service-specific stats
  if (capabilities.gps_tracking) {
    stats.push({
      label: 'Active Sessions',
      icon: 'map-pin',
      api: '/tracking/active'
    });
  }
  
  if (capabilities.prescriptions) {
    stats.push({
      label: 'Pending Rx',
      icon: 'pill',
      api: '/prescriptions/pending'
    });
  }
  
  if (capabilities.inventory) {
    stats.push({
      label: 'Low Stock',
      icon: 'alert',
      api: '/inventory/low-stock-count'
    });
  }
  
  return stats.slice(0, 4); // Max 4 stats on mobile
};
```

### Quick Actions (Dynamic)

```typescript
const getQuickActions = (capabilities: Record<string, boolean>) => {
  const actions = [];
  
  // Capability-based quick actions
  if (capabilities.prescriptions) {
    actions.push({ icon: 'pill', label: 'New Rx', action: 'prescription' });
  }
  
  if (capabilities.gps_tracking) {
    actions.push({ icon: 'map-pin', label: 'Start Track', action: 'tracking' });
  }
  
  if (capabilities.custom_services) {
    actions.push({ icon: 'plus', label: 'New Service', action: 'custom_service' });
  }
  
  if (capabilities.package_management) {
    actions.push({ icon: 'package', label: 'Packages', action: 'packages' });
  }
  
  if (capabilities.staff_management) {
    actions.push({ icon: 'users', label: 'Staff', action: 'staff' });
  }
  
  return actions.slice(0, 4); // Max 4 on mobile
};
```

---

## 🔄 Vendor Lifecycle Screens

### 1. Onboarding Flow

```
Step 1: Phone Verification (OTP)
    ↓
Step 2: Role Selection (from /config/roles)
    - Display: role.display_name, role.description, role.icon
    - Tags: role.vendorTypes, role.serviceStyles
    ↓
Step 3: Business Details
    - Dynamic fields based on role.config.requiredFields
    - Generic labels: "Business Name", "Provider Name"
    ↓
Step 4: Document Upload
    - Documents from role.config.requiredDocuments
    ↓
Step 5: Submitted → Pending Review
```

### 2. Post-Approval Setup

```
Step A: Service Configuration
    - Browse Service Catalog filtered by role
    - Select from: Categories → Subcategories → Services
    - Configure: Price, Duration (if role.pricingControl allows)
    ↓
Step B: Availability Setup
    - Working days + hours
    - Service-style specific:
      * CENTER: Location + operating hours
      * HOME: Coverage area + travel radius
      * TELE: Available slots for video
    ↓
Step C: Profile Completion
    - Photos, description, specializations
    ↓
Active Vendor Dashboard
```

### 3. Active Operations

| Screen | Purpose | Key Features |
|--------|---------|--------------|
| Home | Dashboard overview | Stats, Schedule, Quick Actions |
| Bookings | Manage appointments | List, Calendar, Accept/Decline |
| Services | Manage offerings | Catalog, Custom, Packages |
| Earnings | Financial overview | Revenue, Payouts, Bank |
| Settings | Configuration | Profile, Availability, Preferences |

---

## 📋 Service Catalog Integration

### Generic Service Categories

```json
{
  "categories": [
    {
      "id": "veterinary",
      "name": "Veterinary",
      "icon": "🩺",
      "subcategories": [
        { "id": "consultation", "name": "Consultation" },
        { "id": "vaccination", "name": "Vaccination" },
        { "id": "surgery", "name": "Surgery" }
      ]
    },
    {
      "id": "grooming",
      "name": "Grooming",
      "icon": "✂️",
      "subcategories": [
        { "id": "bath", "name": "Bath & Clean" },
        { "id": "haircut", "name": "Haircut & Styling" },
        { "id": "spa", "name": "Spa & Treatments" }
      ]
    }
  ]
}
```

### Service Selection UI

```
┌─────────────────────────────────────────┐
│  Select Services for Your Business      │
├─────────────────────────────────────────┤
│  🔍 Search services...                  │
├─────────────────────────────────────────┤
│  📁 From Service Catalog                │
│  ├── Veterinary                         │
│  │   ├── ✅ Consultation (₹500-1500)    │
│  │   ├── ✅ Vaccination (₹200-800)      │
│  │   └── ☐ Surgery (₹2000+)            │
│  └── Grooming                           │
│      ├── ✅ Bath & Clean (₹300-600)     │
│      └── ☐ Haircut (₹400-1000)         │
├─────────────────────────────────────────┤
│  ➕ Create Custom Service               │
│  📦 Create Package (Bundle)             │
└─────────────────────────────────────────┘
```

---

## 🎨 Design Theme & Colors

### Color Palette

```css
/* Primary - WarmPawz Orange */
--color-primary: #F97316;
--color-primary-light: #FED7AA;
--color-primary-dark: #EA580C;

/* Status Colors */
--color-success: #22C55E;
--color-warning: #EAB308;
--color-error: #EF4444;
--color-info: #3B82F6;

/* Neutral */
--color-bg: #FAFAFA;
--color-card: #FFFFFF;
--color-text: #1F2937;
--color-text-muted: #6B7280;
--color-border: #E5E7EB;
```

### Role-Based Accent Colors

```typescript
const roleColorSchemes: Record<string, { accent: string; bg: string }> = {
  veterinarian: { accent: '#EF4444', bg: '#FEE2E2' },
  groomer: { accent: '#8B5CF6', bg: '#EDE9FE' },
  trainer: { accent: '#10B981', bg: '#D1FAE5' },
  walker: { accent: '#3B82F6', bg: '#DBEAFE' },
  boarding: { accent: '#F59E0B', bg: '#FEF3C7' },
  cafe: { accent: '#EC4899', bg: '#FCE7F3' },
  pharmacy: { accent: '#14B8A6', bg: '#CCFBF1' },
  // ... more roles
};
```

---

## 📱 Bottom Navigation (Adaptive)

### 4-Tab Configuration (Default)

```typescript
const getBottomNavTabs = (capabilities: Record<string, boolean>) => {
  const tabs = [
    { id: 'home', icon: 'home', label: 'Home', route: '/' },
    { id: 'bookings', icon: 'calendar', label: 'Bookings', route: '/bookings' },
  ];
  
  // Add Chat if enabled
  if (capabilities.chat) {
    tabs.push({ id: 'chat', icon: 'message', label: 'Chat', route: '/chat' });
  }
  
  // Always add Settings
  tabs.push({ id: 'settings', icon: 'settings', label: 'Settings', route: '/settings' });
  
  return tabs;
};
```

### 5-Tab Configuration (For complex roles)

For roles with many capabilities, use a "More" tab:

```
🏠 Home | 📅 Bookings | 💼 Services | 💬 Chat | ⋯ More
```

The "More" tab opens a full-screen menu with all available features.

---

## 🔌 Existing Integrations to Maintain

### 1. Booking System
- Real-time booking notifications
- Accept/Decline/Reschedule flow
- Service style badges (Home/Center/Tele)

### 2. Payment System
- Earnings tracking
- Payout to bank account
- UPI/Bank integration

### 3. Communication
- In-app chat with customers
- Push notifications
- Video calling for tele-consultations

### 4. GPS Tracking
- Live location sharing for mobile services
- Geofencing for service areas
- ETA calculations

### 5. Calendar Integration
- Sync with device calendar
- Block time slots
- Recurring availability

---

## 🛠 Implementation Roadmap

### Phase 1: Core Foundation (Week 1-2)
- [ ] Create `UnifiedVendorDashboard` component
- [ ] Implement capability-based rendering
- [ ] Build adaptive bottom navigation
- [ ] Create generic service selection UI

### Phase 2: Dynamic Features (Week 3-4)
- [ ] Build stats widget generator
- [ ] Create quick actions builder
- [ ] Implement role-based theming
- [ ] Add service style indicators

### Phase 3: Lifecycle Screens (Week 5-6)
- [ ] Refactor onboarding to use generic fields
- [ ] Update service catalog browser
- [ ] Improve availability setup flow
- [ ] Polish settings screens

### Phase 4: Polish & Testing (Week 7-8)
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] Dark mode support
- [ ] Testing on Android/iOS devices

---

## 📊 Metrics for Success

| Metric | Target |
|--------|--------|
| Onboarding completion rate | >85% |
| Time to first booking | <24 hours |
| Daily active usage | >60% of active vendors |
| Feature discoverability | All role features used within 7 days |
| Crash-free sessions | >99.5% |

---

## 🔮 Future Enhancements

1. **AI Assistant** - Voice-activated booking management
2. **Smart Scheduling** - AI-suggested availability based on demand
3. **Performance Insights** - ML-driven business recommendations
4. **Multi-language Support** - Regional language interfaces
5. **Offline Mode** - Basic functionality without internet

---

*Document Version: 1.0*  
*Last Updated: January 2026*  
*Author: AI Assistant*
