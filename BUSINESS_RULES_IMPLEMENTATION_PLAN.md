# Business Rules Implementation Plan
## 19 Business Rules - Implementation Status & Plan

**Date:** 2026-01-07  
**Status:** In Progress

---

## ✅ COMPLETED BUSINESS RULES

### Rule 1: Center Booking Lifecycle ✅
- **Status:** Implemented
- **Components:** `BookingFlow.tsx`, backend endpoints
- **Notes:** Center booking works, prescription/medical records integrated

### Rule 6: ElasticSearch Integration ✅
- **Status:** Implemented
- **Components:** `/search/universal` endpoint, OpenSearch client
- **Notes:** Search-first flow enforced with `SearchFirstGuard`

---

## 🚧 IN PROGRESS BUSINESS RULES

### Rule 2: Home Services with Distance & Previous Provider Priority
**Status:** 70% Complete

**What Exists:**
- ✅ Staff discovery endpoint: `/service-discovery/staff`
- ✅ Vendor radar distance endpoint: `/vendor/:id/radar-distance`
- ✅ GPS tracking endpoints

**What's Missing:**
1. Previous provider prioritization logic
2. Horizontal scroll UI for previous providers
3. Bad feedback de-prioritization

**Implementation Tasks:**
- [ ] Enhance `/service-discovery/staff` to prioritize previous providers
- [ ] Add feedback check to de-prioritize bad providers
- [ ] Create `PreviousProvidersSection.tsx` component
- [ ] Update `HomeServiceBookingFlow.tsx` to show previous providers first

---

### Rule 3: Home Services Scheduling with Buffer & Commute Time
**Status:** 60% Complete

**What Exists:**
- ✅ Commute time endpoint: `/commute-time`
- ✅ Staff availability checking
- ✅ GPS tracking

**What's Missing:**
1. Buffer time calculation in schedule
2. UI display of commute time
3. Buffer time from vendor configuration

**Implementation Tasks:**
- [ ] Add buffer time to vendor settings
- [ ] Update schedule calculation to include buffer + commute
- [ ] Display "Staff will arrive at X (Y min commute)" in UI
- [ ] Update availability check to account for buffer

---

### Rule 4: Tele Services (Instant & Scheduled)
**Status:** 50% Complete

**What Exists:**
- ✅ Video consultation endpoints
- ✅ Staff assignment logic

**What's Missing:**
1. Instant booking flow (show available staff immediately)
2. Scheduled booking flow (same as home services)
3. No GPS tracking (correct - tele services don't need it)

**Implementation Tasks:**
- [ ] Create `TeleServiceBookingFlow.tsx` with instant/scheduled options
- [ ] Add instant booking: show available staff → assign → payment
- [ ] Add scheduled booking: same as home services
- [ ] Ensure no GPS tracking for tele services

---

### Rule 5: Search-Driven Discovery
**Status:** 80% Complete

**What Exists:**
- ✅ Search-first flow enforced with `SearchFirstGuard`
- ✅ Problem grid component
- ✅ Universal search endpoint

**What's Missing:**
1. Some specialized services still bypass search
2. Category tiles may link directly

**Implementation Tasks:**
- [ ] Ensure all category tiles go through search
- [ ] Remove direct booking links from vendor profiles
- [ ] Integrate specialized services into search flow

---

### Rule 7: Integrated Services (Ambulance, Medicine, Diagnostics)
**Status:** 40% Complete

**What Exists:**
- ✅ `SpecializedServiceRouter.tsx` component
- ✅ Ambulance, Diagnostics booking flows

**What's Missing:**
1. These services bypass search (violation)
2. Need to integrate into unified flow
3. Medicine delivery integration incomplete

**Implementation Tasks:**
- [ ] Remove `SpecializedServiceRouter` parallel flow
- [ ] Integrate into main `BookingFlow.tsx`
- [ ] Add medicine delivery booking flow
- [ ] Ensure all go through search-first

---

### Rule 8: Specialized Services (Puppy Profile, Pet Profile Publishing)
**Status:** 30% Complete

**What Exists:**
- ✅ Adoption service components
- ✅ Breeder components

**What's Missing:**
1. Puppy profile publishing flow
2. Lineage display
3. Vaccination status display
4. Nature/behavior information

**Implementation Tasks:**
- [ ] Create `PuppyProfilePublishing.tsx` component
- [ ] Add lineage, vaccination, nature fields
- [ ] Create `BreederProfileView.tsx` for display
- [ ] Integrate into search/booking flow

---

### Rule 9: Nutritionist (Consultation + Food Delivery)
**Status:** 50% Complete

**What Exists:**
- ✅ Nutritionist service components
- ✅ Meal ordering endpoints

**What's Missing:**
1. Hyperlocal delivery integration
2. GPS tracking for delivery
3. Complete delivery lifecycle

**Implementation Tasks:**
- [ ] Add delivery partner assignment
- [ ] Add GPS tracking for delivery
- [ ] Complete delivery lifecycle (order → prepare → assign → track → deliver)

---

### Rule 10: Behaviourist & Trainers (Consultation + Training Packages)
**Status:** 40% Complete

**What Exists:**
- ✅ Training service components
- ✅ Package booking

**What's Missing:**
1. Progress tracking for packages
2. Outcome tracking
3. Tele consultation + home training combination

**Implementation Tasks:**
- [ ] Add progress tracking component
- [ ] Add outcome measurement
- [ ] Support tele consultation + home training in same package

---

### Rule 11: Pet Cafe (Zomato-like Listing)
**Status:** 60% Complete

**What Exists:**
- ✅ Pet cafe endpoints: `/vendor/:id/tables`
- ✅ Table availability checking

**What's Missing:**
1. Complete listing UI (directions, photos, amenities, menu)
2. Table booking with pax count
3. Pet policy display
4. Booking policy display

**Implementation Tasks:**
- [ ] Create `PetCafeListing.tsx` with full details
- [ ] Add table booking flow with pax
- [ ] Display pet policy and booking policy
- [ ] Add directions, photos, amenities display

---

### Rule 12: Pet Resort & Boarding
**Status:** 50% Complete

**What Exists:**
- ✅ Resort endpoints: `/vendor/:id/rooms`
- ✅ Room availability checking

**What's Missing:**
1. Complete resort listing (photos, amenities, policies)
2. Pre-check-in form for pet owner
3. Nightly hours pricing display
4. Room configuration display

**Implementation Tasks:**
- [ ] Create `PetResortListing.tsx` with full details
- [ ] Add pre-check-in form
- [ ] Display nightly pricing and room config
- [ ] Add cancellation policy display

---

### Rule 13: Pet Insurance
**Status:** 30% Complete

**What Exists:**
- ✅ Insurance service components

**What's Missing:**
1. Plan listing and comparison
2. Policy purchase flow
3. Document upload
4. Policy download
5. Claim filing

**Implementation Tasks:**
- [ ] Create `InsurancePlansListing.tsx`
- [ ] Add policy purchase flow
- [ ] Add document upload
- [ ] Add policy download
- [ ] Add claim filing flow

---

### Rule 14: Pet Holidays
**Status:** 50% Complete

**What Exists:**
- ✅ Holiday packages endpoints: `/holidays/packages`
- ✅ Package booking endpoint

**What's Missing:**
1. Package listing UI (group tour, type, inclusions/exclusions)
2. Date availability display
3. Duration and pricing display

**Implementation Tasks:**
- [ ] Create `PetHolidaysListing.tsx`
- [ ] Display package details (type, inclusions/exclusions)
- [ ] Add date availability calendar
- [ ] Display duration and pricing

---

### Rule 15: Pet Walker
**Status:** 60% Complete

**What Exists:**
- ✅ Walker service components
- ✅ Route map tracker
- ✅ Session tracking

**What's Missing:**
1. Solo vendor mode for walkers
2. Staff dashboard access for solo walkers

**Implementation Tasks:**
- [ ] Add solo vendor mode support
- [ ] Allow solo walkers to access staff dashboard
- [ ] Ensure route tracking works for solo mode

---

### Rule 16: Payment, GPS, Video, Chat, Notifications
**Status:** 80% Complete

**What Exists:**
- ✅ Razorpay integration
- ✅ GPS tracking
- ✅ Video calling
- ✅ Chat system
- ✅ Notification system

**What's Missing:**
1. Automated bank account verification
2. Settlement automation
3. Tier-based commission calculation

**Implementation Tasks:**
- [ ] Add automated bank verification
- [ ] Complete settlement automation
- [ ] Add tier-based commission calculation

---

### Rule 17: Vendor Onboarding & Dashboard Capabilities
**Status:** 90% Complete

**What Exists:**
- ✅ Dynamic vendor onboarding
- ✅ Role-based capabilities
- ✅ Service management
- ✅ Staff management

**What's Missing:**
1. Verify all 45 capabilities are wired
2. Ensure capabilities match role config

**Implementation Tasks:**
- [ ] Audit all 45 capabilities
- [ ] Verify each capability is wired correctly
- [ ] Test CRUD operations for each capability

---

### Rule 18: Schedule Configuration
**Status:** 70% Complete

**What Exists:**
- ✅ Staff schedule management
- ✅ Center schedule management

**What's Missing:**
1. Value-added services flows
2. Convenience-focused scheduling

**Implementation Tasks:**
- [ ] Review all value-added services
- [ ] Ensure convenient scheduling for customers
- [ ] Add buffer time configuration

---

### Rule 19: Admin Governance
**Status:** 85% Complete

**What Exists:**
- ✅ Vendor administration
- ✅ Tier configuration
- ✅ Tax configuration
- ✅ Commission rules
- ✅ Coupons & promotions
- ✅ Reports & analytics

**What's Missing:**
1. Some policy configurations
2. Complete dispute resolution

**Implementation Tasks:**
- [ ] Complete policy configuration UI
- [ ] Add dispute resolution flow
- [ ] Verify all admin capabilities

---

## 📋 IMPLEMENTATION PRIORITY

### Phase 1: Critical Flow Fixes (This Week)
1. ✅ Remove parallel booking flows (SpecializedServiceRouter)
2. ✅ Enforce search-first for all services
3. ✅ Integrate specialized services into unified flow

### Phase 2: Home Services Enhancement (Next Week)
4. Previous provider prioritization
5. Buffer time & commute time display
6. Distance/radar configuration UI

### Phase 3: Specialized Services (Week 3)
7. Pet cafe complete listing
8. Pet resort complete listing
9. Pet holidays listing
10. Insurance complete flow

### Phase 4: Advanced Features (Week 4)
11. Progress tracking for packages
12. Delivery lifecycle completion
13. Automated settlements
14. Tier-based commission

---

## 🎯 SUCCESS CRITERIA

- ✅ All booking flows start from search
- ✅ No parallel booking implementations
- ✅ All 19 business rules fully implemented
- ✅ All 45 vendor capabilities wired
- ✅ Complete specialized service flows
- ✅ Automated settlements working
- ✅ 100% API integration

---

**Last Updated:** 2026-01-07

