# Vendor Dashboard Wireframe Implementation - Complete Guide

## ✅ Implementation Status

### **Completed Components:**

1. **Capability Route Mapping** (`apps/vendor-web/lib/capability-routes.ts`)
   - ✅ All 45 capabilities mapped to proper routes
   - ✅ Parent-child route relationships defined
   - ✅ Business-only capability filtering
   - ✅ Category-based organization

2. **Dynamic Navigation Component** (`apps/vendor-web/components/vendor/navigation/VendorDynamicNavigation.tsx`)
   - ✅ Category-based navigation grouping
   - ✅ Active route highlighting
   - ✅ Responsive sidebar design
   - ✅ Dynamic capability filtering

3. **Updated Dashboard** (`apps/vendor-web/components/vendor/VendorCapabilityDashboard.tsx`)
   - ✅ Integrated with capability routing system
   - ✅ Dynamic navigation integration
   - ✅ Quick actions with proper routing
   - ✅ Business/solo vendor filtering

4. **Wireframe Documentation** (`docs/VENDOR_CAPABILITY_WIREFRAME_MAP.md`)
   - ✅ Complete capability categorization
   - ✅ Route structure documentation
   - ✅ Navigation hierarchy
   - ✅ Implementation checklist

---

## 🗺️ Route Structure

### **Core Routes (Always Available)**
- `/` - Dashboard
- `/bookings` - All bookings
- `/profile` - Profile management

### **Service Routes**
- `/services` - Service catalog
- `/services/packages` - Package management
- `/services/pricing` - Pricing management
- `/services/tests` - Test catalog (diagnostics)
- `/services/menu` - Menu management (cafe)
- `/services/products` - Product catalog (e-commerce)
- `/services/subscriptions` - Subscription plans

### **Booking Sub-Routes**
- `/bookings/centre` - In-center appointments
- `/bookings/home` - At-home visits
- `/bookings/tele` - Tele consultations
- `/bookings/walking` - Walking sessions
- `/bookings/reservations` - Table reservations
- `/bookings/checkin` - Check-in/out (resort)
- `/bookings/routes` - Route tracking

### **Specialized Routes (Role-Based)**
- `/staff` - Staff management (Business only)
- `/schedule` - Schedule management
- `/schedule/radius` - Service radius
- `/schedule/gps` - GPS tracking
- `/finance/earnings` - Earnings
- `/finance/settlements` - Settlements
- `/finance/bank` - Bank account
- `/medical/*` - Medical capabilities (Vet roles)
- `/pharmacy/*` - Pharmacy capabilities
- `/ambulance/*` - Ambulance capabilities
- `/cafe/*` - Cafe capabilities
- `/resort/*` - Resort capabilities
- `/insurance/*` - Insurance capabilities
- `/adoption/*` - Adoption capabilities
- `/training/*` - Training capabilities
- `/nutrition/*` - Nutrition capabilities
- `/holidays/*` - Holiday/tour capabilities
- `/seller/*` - E-commerce capabilities
- `/communication/*` - Communication
- `/operations/*` - Operations

---

## 🎯 How It Works

### **1. Dynamic Loading Flow**

```
Vendor Login
  ↓
Load Vendor Profile (includes role_id, vendor_type)
  ↓
Fetch Role Capabilities from /config/roles/{roleId}
  ↓
Filter Capabilities:
  - By role permissions (from database)
  - By vendor type (hide staff for solo)
  - Core capabilities always shown
  ↓
Generate Navigation Menu
  ↓
Render Dashboard with Dynamic Navigation
```

### **2. Navigation Generation**

The `VendorDynamicNavigation` component:
- Groups capabilities by category
- Shows only enabled capabilities
- Highlights active route
- Filters out staff for solo vendors

### **3. Route Access Control**

Each route is protected by:
- Capability check (from role permissions)
- Vendor type check (for business-only features)
- Route guards (can be added per route)

---

## 📱 Mobile App Structure

The mobile app should follow the same capability structure:
- Bottom tab navigation for core capabilities
- Drawer menu for all capabilities
- Stack navigation for sub-routes
- Same filtering logic (solo vs business)

---

## 🔧 Next Steps

### **To Complete 100% Coverage:**

1. **Create Page Components** for each route:
   - [ ] `/bookings/centre` - Centre bookings page
   - [ ] `/bookings/home` - Home services page
   - [ ] `/bookings/tele` - Tele consultation page
   - [ ] `/bookings/walking` - Walking sessions page
   - [ ] `/services/packages` - Package management page
   - [ ] `/services/pricing` - Pricing management page
   - [ ] `/schedule/radius` - Service radius page
   - [ ] `/schedule/gps` - GPS tracking page
   - [ ] `/finance/*` - Finance pages
   - [ ] `/medical/*` - Medical pages
   - [ ] `/pharmacy/*` - Pharmacy pages
   - [ ] `/ambulance/*` - Ambulance pages
   - [ ] `/cafe/*` - Cafe pages
   - [ ] `/resort/*` - Resort pages
   - [ ] `/insurance/*` - Insurance pages
   - [ ] `/adoption/*` - Adoption pages
   - [ ] `/training/*` - Training pages
   - [ ] `/nutrition/*` - Nutrition pages
   - [ ] `/holidays/*` - Holiday pages
   - [ ] `/seller/*` - Seller pages
   - [ ] `/communication/*` - Communication pages
   - [ ] `/operations/*` - Operations pages

2. **Add Route Guards**:
   - Create middleware to check capabilities before route access
   - Redirect to dashboard if capability not available

3. **Update Mobile App**:
   - Implement same navigation structure
   - Use same capability routing system
   - Add mobile-specific UI components

4. **Testing**:
   - Test with different roles (vet, groomer, cafe, etc.)
   - Test with solo vs business vendors
   - Verify all 45 capabilities are accessible
   - Verify proper filtering works

---

## 📊 Capability Coverage Matrix

| Category | Total Capabilities | Implemented | Routes Created | Pages Needed |
|----------|------------------|-------------|----------------|--------------|
| Core | 3 | ✅ | ✅ | ✅ |
| Services | 7 | ✅ | ✅ | ⚠️ Partial |
| Bookings | 7 | ✅ | ✅ | ⚠️ Partial |
| Operations | 6 | ✅ | ✅ | ⚠️ Partial |
| Finance | 3 | ✅ | ✅ | ⚠️ Partial |
| Communication | 3 | ✅ | ✅ | ⚠️ Partial |
| Specialized | 16 | ✅ | ✅ | ⚠️ Partial |
| **Total** | **45** | **✅** | **✅** | **⚠️ Partial** |

---

## 🎨 UI/UX Guidelines

1. **Navigation**:
   - Sidebar navigation on desktop
   - Bottom tabs on mobile
   - Category grouping for clarity
   - Active state highlighting

2. **Dashboard**:
   - Stats overview at top
   - Today's bookings widget
   - Quick actions (8 most used)
   - Recent activity feed

3. **Page Layout**:
   - Consistent header with breadcrumbs
   - Action buttons (Add, Edit, Delete)
   - Data tables/lists
   - Filters and search

4. **Responsive Design**:
   - Mobile-first approach
   - Breakpoints: mobile, tablet, desktop
   - Touch-friendly buttons
   - Swipe gestures where appropriate

---

## ✅ Verification Checklist

- [x] Capability route mapping created
- [x] Dynamic navigation component created
- [x] Dashboard integrated with routing
- [x] Business/solo vendor filtering
- [x] Wireframe documentation
- [ ] All page components created
- [ ] Route guards implemented
- [ ] Mobile app updated
- [ ] Testing completed
- [ ] 100% capability coverage verified

---

## 📝 Notes

- All capabilities are dynamically loaded from role configuration
- Staff capability is automatically hidden for solo vendors
- Core capabilities (dashboard, bookings, profile) are always shown
- Each capability has its own route and can have sub-routes
- Navigation is generated dynamically based on enabled capabilities
- The system supports unlimited role combinations

