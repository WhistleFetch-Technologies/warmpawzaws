# Wireframe Architecture & Navigation Flow
## Detailed Component Hierarchy & User Flows

---

## Customer App Wireframes

### Main Navigation Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    CustomerHomeWrapper                       │
│                  (Central Router - 144 Screens)             │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Service       │  │ Profile       │  │ Booking       │
│ Discovery     │  │ Management     │  │ Management     │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Service       │  │ Pet Profile   │  │ My Bookings   │
│ Landing       │  │ User Profile  │  │ Booking Detail│
│ Pages         │  │ Pet Details   │  │ Reschedule    │
└───────────────┘  └───────────────┘  └───────────────┘
```

### Service Discovery Flow (Detailed)

```
┌─────────────────────────────────────────────────────────────┐
│              Service Landing Page                            │
│  (VetServicesLanding, GroomingServicesLanding, etc.)        │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Problem Grid  │  │ Direct        │  │ Service       │
│ Selection     │  │ Booking       │  │ Router        │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Vendor        │  │ Booking      │  │ Vendor List   │
│ Discovery     │  │ Flow         │  │ View          │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Vendor        │  │ Payment       │  │ Vendor        │
│ Profile       │  │ Processing    │  │ Profile       │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                  ┌───────────────────┐
                  │ Booking            │
                  │ Confirmation       │
                  └───────────────────┘
```

### Service Router Pattern (Example: VetServiceRouter)

```
┌─────────────────────────────────────────────────────────────┐
│                    VetServiceRouter                         │
│              (Internal State Management)                    │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Landing       │  │ Problem Grid  │  │ Clinic List   │
│ View          │  │ View          │  │ View          │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Service       │  │ Vendor        │  │ Clinic        │
│ Selection     │  │ Discovery     │  │ Profile       │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                  ┌───────────────────┐
                  │ Booking Router    │
                  │ (VetBookingRouter)│
                  └───────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Doctor        │  │ Service       │  │ Time Slot     │
│ Selection     │  │ Selection     │  │ Selection     │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                  ┌───────────────────┐
                  │ Payment &          │
                  │ Confirmation       │
                  └───────────────────┘
```

---

## Vendor App Wireframes

### Vendor Lifecycle States

```
┌─────────────────────────────────────────────────────────────┐
│                  VendorLandingPage                          │
│            (State-Based Router - 12+ States)                │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ New Vendor    │  │ Pending       │  │ Active        │
│ State         │  │ State         │  │ State         │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Role          │  │ Application   │  │ Vendor        │
│ Selection     │  │ Under Review  │  │ Dashboard     │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        ▼                   ▼                   │
┌───────────────┐  ┌───────────────┐            │
│ Onboarding    │  │ Clarification │            │
│ Form          │  │ Requested     │            │
└───────────────┘  └───────────────┘            │
        │                   │                   │
        ▼                   ▼                   │
┌───────────────┐  ┌───────────────┐            │
│ Application   │  │ Resubmit      │            │
│ Submitted     │  │ Documents     │            │
└───────────────┘  └───────────────┘            │
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                  ┌───────────────────┐
                  │ Setup Flow        │
                  │ (Services →        │
                  │  Availability)    │
                  └───────────────────┘
```

### Vendor Dashboard Structure

```
┌─────────────────────────────────────────────────────────────┐
│                  VendorDashboard                            │
│         (Capability-Based Dynamic UI)                        │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Quick Actions │  │ Today's       │  │ Analytics     │
│ (Capability   │  │ Schedule      │  │ & Metrics     │
│  Based)       │  │               │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Capability    │  │ Booking       │  │ Revenue       │
│ Screens       │  │ Management    │  │ Dashboard     │
│ (30+ screens) │  │               │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
```

### Capability Screen Navigation

```
┌─────────────────────────────────────────────────────────────┐
│              Capability Screen (Example)                    │
│         (Gallery, Events, Booking, etc.)                    │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ List View     │  │ Create/Edit   │  │ Detail View   │
│ (Read)        │  │ Modal        │  │ (Read)        │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ CRUD          │  │ Validation    │  │ Delete        │
│ Operations    │  │ & Error       │  │ Confirmation   │
│               │  │ Handling      │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
```

---

## Admin App Wireframes

### Admin Navigation Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    AdminApp                                 │
│              (View-Based Router)                             │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Vendor        │  │ Catalog       │  │ Payment/      │
│ Management    │  │ Management    │  │ Refund        │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Application   │  │ Service       │  │ Transaction   │
│ Review        │  │ Catalog       │  │ Management    │
└───────────────┘  └───────────────┘  └───────────────┘
```

---

## Navigation Patterns Analysis

### Pattern 1: State-Based Routing (Vendor App)
**Used In:** VendorLandingPage, VendorApp
**Pros:**
- Clear state transitions
- Easy to understand flow
- Good for lifecycle management

**Cons:**
- Complex state management
- Hard to debug state issues
- No formal state machine

### Pattern 2: Screen Type Routing (Customer App)
**Used In:** CustomerHomeWrapper
**Pros:**
- Flexible navigation
- Easy to add new screens
- Type-safe (TypeScript)

**Cons:**
- Too many screen types (144!)
- Hard to maintain
- Deep nesting

### Pattern 3: View-Based Routing (Admin App)
**Used In:** AdminApp
**Pros:**
- Simple navigation
- Easy to understand
- Clear separation

**Cons:**
- Manual view mapping
- Not type-safe
- Inconsistent back navigation

### Pattern 4: Service Router Pattern (Customer App)
**Used In:** VetServiceRouter, GroomingServiceRouter, etc.
**Pros:**
- Service-specific logic
- Reusable components
- Clear flow

**Cons:**
- Code duplication
- Inconsistent patterns
- Hard to maintain

---

## Recommended Navigation Architecture

### Unified Router Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    App Router                               │
│              (Single Source of Truth)                       │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Customer      │  │ Vendor        │  │ Admin         │
│ Router        │  │ Router        │  │ Router        │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Service       │  │ State         │  │ View          │
│ Category      │  │ Machine       │  │ Router        │
│ Router        │  │ Router        │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
```

### Benefits:
1. **Consistency:** Same pattern across all apps
2. **Maintainability:** Easier to update navigation
3. **Type Safety:** TypeScript support
4. **Debugging:** Easier to trace navigation
5. **Testing:** Easier to test navigation flows

---

## Screen Size & Responsive Breakpoints

### Mobile (Current Focus)
- **Small:** 320px - 375px (iPhone SE, iPhone 8)
- **Medium:** 376px - 430px (iPhone 12, iPhone 14 Pro Max)
- **Layout:** Single column, stacked components
- **Navigation:** Bottom navigation or hamburger menu

### Tablet (Needs Work)
- **Small Tablet:** 768px - 1024px (iPad)
- **Layout:** Two columns possible, side navigation
- **Navigation:** Sidebar navigation

### Desktop (Needs Work)
- **Desktop:** 1024px - 1920px+
- **Layout:** Multi-column, sidebar navigation
- **Navigation:** Top bar + sidebar

---

## Component Hierarchy Recommendations

### Current Issues:
1. **Too Deep:** Some components 5+ levels deep
2. **Too Wide:** CustomerHomeWrapper has 144 screen types
3. **Inconsistent:** Different patterns across apps

### Recommended Structure:

```
App (Level 0)
  ├─ CustomerApp (Level 1)
  │   ├─ CustomerHomeWrapper (Level 2)
  │   │   ├─ ServiceCategoryRouter (Level 3)
  │   │   │   ├─ ServiceLanding (Level 4)
  │   │   │   └─ ServiceBookingFlow (Level 4)
  │   │   ├─ ProfileRouter (Level 3)
  │   │   └─ BookingRouter (Level 3)
  │   └─ OnboardingFlow (Level 2)
  ├─ VendorApp (Level 1)
  │   └─ VendorLandingPage (Level 2)
  │       ├─ VendorDashboard (Level 3)
  │       └─ CapabilityScreens (Level 3)
  └─ AdminApp (Level 1)
      └─ AdminDashboard (Level 2)
          └─ ManagementScreens (Level 3)
```

**Max Depth:** 4 levels (reduced from 5+)
**Screen Types:** ~20 categories (reduced from 144)

---

## Wireframe Testing Checklist

### Navigation Flow Testing
- [ ] All navigation paths work
- [ ] Back navigation works correctly
- [ ] Deep linking works
- [ ] State persistence works
- [ ] Error states handled

### Responsive Testing
- [ ] Mobile (320px - 430px) ✅
- [ ] Tablet (768px - 1024px) ⚠️
- [ ] Desktop (1024px+) ⚠️

### Component Testing
- [ ] All components render correctly
- [ ] Loading states work
- [ ] Error states work
- [ ] Empty states work
- [ ] Success states work

### Integration Testing
- [ ] API calls work
- [ ] Data flows correctly
- [ ] State updates correctly
- [ ] Notifications work
- [ ] Payments work

---

**Document Version:** 1.0  
**Last Updated:** 2024

