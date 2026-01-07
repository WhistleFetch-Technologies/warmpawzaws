# Vendor Capability Wireframe Map - Complete 45 Capabilities

**Purpose:** Complete mapping of all 45 capabilities to their proper UI locations and wireframe structure

---

## 📊 CAPABILITY CATEGORIZATION

### **1. DASHBOARD (Main Landing)**
Capabilities that appear on the main dashboard:
- `dashboard` - Overview stats, quick actions
- `bookings` - Today's bookings widget
- `earnings` - Earnings summary widget
- `notifications` - Recent notifications widget

### **2. BOOKINGS SECTION** (`/bookings`)
Capabilities tied to booking lifecycle:
- `bookings` - Main booking management
- `centre_booking` - In-center appointments
- `home_services` - At-home visit bookings
- `tele_consultation` - Tele-consultation bookings
- `walking` - Walking session bookings
- `reservations` - Table reservations (cafe)
- `checkin_checkout` - Check-in/out (resort/boarding)
- `route_tracking` - GPS route tracking for bookings

### **3. SERVICES & CATALOG** (`/services`)
Capabilities for service/catalog management:
- `services` - Service catalog management
- `packages` - Package creation and management
- `pricing` - Service pricing management
- `test_catalog` - Test catalog (diagnostics)
- `menu` - Menu management (cafe)
- `products` - Product catalog (e-commerce)
- `subscriptions` - Subscription plans (meal plans, etc.)

### **4. STAFF MANAGEMENT** (`/staff`) - Business Only
- `staff` - Staff CRUD operations
- `staff_schedule` - Staff availability (handled in schedule section)

### **5. SCHEDULE & AVAILABILITY** (`/schedule`)
- `schedule` - Main schedule management
- `service_radius` - Service coverage area
- `gps_tracking` - Live location tracking

### **6. FINANCE** (`/finance`)
- `earnings` - Earnings dashboard
- `settlements` - Settlement history
- `bank_account` - Bank account management
- `pricing` - Pricing management (also in services)

### **7. MEDICAL & HEALTHCARE** (`/medical`)
- `prescriptions` - Prescription management
- `medical_records` - Patient medical records
- `vaccination` - Vaccination records
- `diagnostics` - Diagnostic test results
- `test_catalog` - Test catalog management

### **8. PHARMACY** (`/pharmacy`)
- `pharmacy` - Pharmacy inventory
- `inventory` - Stock management
- `orders` - Medicine orders (e-commerce)

### **9. AMBULANCE** (`/ambulance`)
- `ambulance` - Emergency dispatch
- `vehicles` - Fleet management
- `gps_tracking` - Vehicle tracking

### **10. CAFE** (`/cafe`)
- `cafe_tables` - Table management
- `menu` - Menu management
- `reservations` - Table reservations

### **11. RESORT & BOARDING** (`/resort`)
- `rooms` - Room management
- `boarding` - Boarding management
- `checkin_checkout` - Guest check-in/out

### **12. INSURANCE** (`/insurance`)
- `insurance_plans` - Plan management
- `policies` - Active policies
- `claims` - Claims processing

### **13. ADOPTION & BREEDING** (`/adoption`)
- `adoption` - Adoption listings
- `pet_profiles` - Pet profile management
- `lineage` - Pedigree records

### **14. TRAINING** (`/training`)
- `training_programs` - Training program management
- `progress_tracking` - Training progress tracking
- `packages` - Training packages

### **15. NUTRITION** (`/nutrition`)
- `meal_plans` - Meal plan creation
- `food_delivery` - Food delivery orders
- `subscriptions` - Meal subscriptions

### **16. HOLIDAYS & TOURS** (`/holidays`)
- `holiday_packages` - Tour package creation
- `tour_schedule` - Tour schedule management

### **17. E-COMMERCE** (`/seller`)
- `products` - Product catalog
- `orders` - Order management
- `seller_hub` - Seller dashboard
- `inventory` - Product inventory

### **18. COMMUNICATION** (`/communication`)
- `chat` - Customer messages
- `video_call` - Video consultations
- `notifications` - Notifications center

### **19. OPERATIONS** (`/operations`)
- `reviews` - Customer reviews
- `analytics` - Business analytics
- `reports` - Report generation
- `settings` - App settings

### **20. PROFILE** (`/profile`)
- `profile` - Vendor profile management

---

## 🗺️ WIREFRAME STRUCTURE

### **Main Navigation Structure**

```
Vendor Dashboard (Dynamic based on role)
├── Dashboard (/)
│   ├── Stats Overview
│   ├── Today's Bookings
│   ├── Quick Actions (filtered by capabilities)
│   └── Recent Activity
│
├── Bookings (/bookings)
│   ├── All Bookings
│   ├── Centre Bookings (/bookings/centre)
│   ├── Home Services (/bookings/home)
│   ├── Tele Consultations (/bookings/tele)
│   ├── Walking Sessions (/bookings/walking)
│   ├── Reservations (/bookings/reservations) - Cafe
│   └── Check-in/Out (/bookings/checkin) - Resort
│
├── Services (/services)
│   ├── Service Catalog
│   ├── Packages (/services/packages)
│   ├── Pricing (/services/pricing)
│   ├── Test Catalog (/services/tests) - Diagnostics
│   ├── Menu (/services/menu) - Cafe
│   ├── Products (/services/products) - E-commerce
│   └── Subscriptions (/services/subscriptions)
│
├── Staff (/staff) - Business Only
│   ├── Staff List
│   ├── Add Staff
│   └── Staff Schedule
│
├── Schedule (/schedule)
│   ├── Availability Calendar
│   ├── Service Radius (/schedule/radius)
│   └── GPS Tracking (/schedule/gps)
│
├── Finance (/finance)
│   ├── Earnings (/finance/earnings)
│   ├── Settlements (/finance/settlements)
│   └── Bank Account (/finance/bank)
│
├── Medical (/medical) - Healthcare Roles
│   ├── Prescriptions (/medical/prescriptions)
│   ├── Medical Records (/medical/records)
│   ├── Vaccination (/medical/vaccination)
│   ├── Diagnostics (/medical/diagnostics)
│   └── Test Catalog (/medical/tests)
│
├── Pharmacy (/pharmacy) - Pharmacy Role
│   ├── Inventory (/pharmacy/inventory)
│   └── Orders (/pharmacy/orders)
│
├── Ambulance (/ambulance) - Ambulance Role
│   ├── Dispatch (/ambulance/dispatch)
│   ├── Vehicles (/ambulance/vehicles)
│   └── GPS Tracking (/ambulance/tracking)
│
├── Cafe (/cafe) - Cafe Role
│   ├── Tables (/cafe/tables)
│   ├── Menu (/cafe/menu)
│   └── Reservations (/cafe/reservations)
│
├── Resort (/resort) - Resort Role
│   ├── Rooms (/resort/rooms)
│   ├── Boarding (/resort/boarding)
│   └── Check-in/Out (/resort/checkin)
│
├── Insurance (/insurance) - Insurance Role
│   ├── Plans (/insurance/plans)
│   ├── Policies (/insurance/policies)
│   └── Claims (/insurance/claims)
│
├── Adoption (/adoption) - Adoption Role
│   ├── Listings (/adoption/listings)
│   ├── Pet Profiles (/adoption/pets)
│   └── Lineage (/adoption/lineage)
│
├── Training (/training) - Trainer Role
│   ├── Programs (/training/programs)
│   ├── Progress (/training/progress)
│   └── Packages (/training/packages)
│
├── Nutrition (/nutrition) - Nutritionist Role
│   ├── Meal Plans (/nutrition/plans)
│   ├── Delivery (/nutrition/delivery)
│   └── Subscriptions (/nutrition/subscriptions)
│
├── Holidays (/holidays) - Tour Organizer Role
│   ├── Packages (/holidays/packages)
│   └── Schedule (/holidays/schedule)
│
├── Seller (/seller) - E-commerce Role
│   ├── Products (/seller/products)
│   ├── Orders (/seller/orders)
│   └── Hub (/seller/hub)
│
├── Communication (/communication)
│   ├── Messages (/communication/messages)
│   ├── Video Calls (/communication/video)
│   └── Notifications (/communication/notifications)
│
├── Operations (/operations)
│   ├── Reviews (/operations/reviews)
│   ├── Analytics (/operations/analytics)
│   ├── Reports (/operations/reports)
│   └── Settings (/operations/settings)
│
└── Profile (/profile)
    └── Profile Management
```

---

## 🎯 CAPABILITY TO ROUTE MAPPING

| Capability | Primary Route | Secondary Route | Category | Notes |
|------------|---------------|-----------------|----------|-------|
| `dashboard` | `/` | - | Core | Main dashboard |
| `bookings` | `/bookings` | - | Core | All bookings |
| `centre_booking` | `/bookings/centre` | `/bookings?style=centre` | Services | In-center bookings |
| `home_services` | `/bookings/home` | `/bookings?style=home` | Services | At-home bookings |
| `tele_consultation` | `/bookings/tele` | `/bookings?style=tele` | Services | Tele consultations |
| `walking` | `/bookings/walking` | `/walking` | Specialized | Walking sessions |
| `reservations` | `/bookings/reservations` | `/cafe/reservations` | Specialized | Table reservations |
| `checkin_checkout` | `/bookings/checkin` | `/resort/checkin` | Specialized | Guest check-in/out |
| `services` | `/services` | - | Services | Service catalog |
| `packages` | `/services/packages` | `/packages` | Services | Package management |
| `pricing` | `/services/pricing` | `/finance/pricing` | Finance | Pricing management |
| `test_catalog` | `/services/tests` | `/medical/tests` | Specialized | Test catalog |
| `menu` | `/services/menu` | `/cafe/menu` | Specialized | Menu management |
| `products` | `/services/products` | `/seller/products` | Specialized | Product catalog |
| `subscriptions` | `/services/subscriptions` | `/nutrition/subscriptions` | Specialized | Subscription plans |
| `staff` | `/staff` | - | Operations | Staff management (Business only) |
| `schedule` | `/schedule` | - | Operations | Schedule management |
| `service_radius` | `/schedule/radius` | `/settings/radius` | Operations | Coverage area |
| `gps_tracking` | `/schedule/gps` | `/ambulance/tracking` | Operations | GPS tracking |
| `earnings` | `/finance/earnings` | `/earnings` | Finance | Earnings dashboard |
| `settlements` | `/finance/settlements` | `/settlements` | Finance | Settlement history |
| `bank_account` | `/finance/bank` | `/bank` | Finance | Bank account |
| `prescriptions` | `/medical/prescriptions` | `/prescriptions` | Specialized | Prescription management |
| `medical_records` | `/medical/records` | `/medical-records` | Specialized | Patient records |
| `vaccination` | `/medical/vaccination` | `/vaccination` | Specialized | Vaccination records |
| `diagnostics` | `/medical/diagnostics` | `/diagnostics` | Specialized | Diagnostic results |
| `pharmacy` | `/pharmacy` | - | Specialized | Pharmacy inventory |
| `inventory` | `/pharmacy/inventory` | `/inventory` | Specialized | Stock management |
| `orders` | `/pharmacy/orders` | `/seller/orders` | Specialized | Order management |
| `ambulance` | `/ambulance` | - | Specialized | Emergency dispatch |
| `vehicles` | `/ambulance/vehicles` | `/vehicles` | Specialized | Fleet management |
| `cafe_tables` | `/cafe/tables` | `/tables` | Specialized | Table management |
| `rooms` | `/resort/rooms` | `/rooms` | Specialized | Room management |
| `boarding` | `/resort/boarding` | `/boarding` | Specialized | Boarding management |
| `insurance_plans` | `/insurance/plans` | `/insurance-plans` | Specialized | Plan management |
| `policies` | `/insurance/policies` | `/policies` | Specialized | Active policies |
| `claims` | `/insurance/claims` | `/claims` | Specialized | Claims processing |
| `adoption` | `/adoption` | - | Specialized | Adoption listings |
| `pet_profiles` | `/adoption/pets` | `/pet-profiles` | Specialized | Pet profiles |
| `lineage` | `/adoption/lineage` | `/lineage` | Specialized | Pedigree records |
| `training_programs` | `/training/programs` | `/training` | Specialized | Training programs |
| `progress_tracking` | `/training/progress` | `/progress` | Specialized | Progress tracking |
| `meal_plans` | `/nutrition/plans` | `/meal-plans` | Specialized | Meal plans |
| `food_delivery` | `/nutrition/delivery` | `/food-delivery` | Specialized | Food delivery |
| `holiday_packages` | `/holidays/packages` | `/holidays` | Specialized | Tour packages |
| `tour_schedule` | `/holidays/schedule` | `/tours` | Specialized | Tour schedule |
| `seller_hub` | `/seller/hub` | `/seller` | Specialized | Seller dashboard |
| `chat` | `/communication/messages` | `/messages` | Communication | Customer messages |
| `video_call` | `/communication/video` | `/video` | Communication | Video calls |
| `notifications` | `/communication/notifications` | `/notifications` | Communication | Notifications |
| `reviews` | `/operations/reviews` | `/reviews` | Operations | Customer reviews |
| `analytics` | `/operations/analytics` | `/analytics` | Operations | Business analytics |
| `reports` | `/operations/reports` | `/reports` | Operations | Report generation |
| `settings` | `/operations/settings` | `/settings` | Operations | App settings |
| `profile` | `/profile` | - | Core | Profile management |
| `route_tracking` | `/bookings/routes` | `/walking/routes` | Specialized | Route tracking |

---

## 🔄 DYNAMIC RENDERING LOGIC

### **1. Navigation Menu Generation**
```typescript
// Generate navigation based on enabled capabilities
const navigationItems = enabledCapabilities
  .filter(cap => cap.category !== 'core' || cap.name === 'dashboard')
  .map(cap => ({
    id: cap.id,
    label: cap.display_name,
    icon: cap.icon,
    route: cap.route,
    category: cap.category
  }))
  .groupBy(category);
```

### **2. Dashboard Widgets**
```typescript
// Show widgets for capabilities that have dashboard presence
const dashboardWidgets = enabledCapabilities
  .filter(cap => 
    ['bookings', 'earnings', 'notifications', 'schedule'].includes(cap.name)
  );
```

### **3. Quick Actions**
```typescript
// Show quick actions for frequently used capabilities
const quickActions = enabledCapabilities
  .filter(cap => 
    ['services', 'bookings', 'schedule', 'earnings', 'chat'].includes(cap.name)
  )
  .slice(0, 8);
```

### **4. Route Guards**
```typescript
// Check capability before allowing route access
function canAccessRoute(capability: string): boolean {
  return enabledCapabilities.some(cap => cap.name === capability);
}
```

---

## 📱 MOBILE APP STRUCTURE

Same capability structure, but with:
- Bottom tab navigation for core capabilities
- Drawer menu for all capabilities
- Stack navigation for sub-routes
- Swipe gestures for quick access

---

## ✅ IMPLEMENTATION CHECKLIST

- [ ] Create routing structure for all 45 capabilities
- [ ] Create navigation component with dynamic menu
- [ ] Create page components for each capability category
- [ ] Wire capabilities to proper routes
- [ ] Add route guards based on capabilities
- [ ] Create mobile app navigation structure
- [ ] Test with different roles (solo vs business)
- [ ] Test with different role types (vet, groomer, cafe, etc.)
- [ ] Ensure 100% coverage of all 45 capabilities

