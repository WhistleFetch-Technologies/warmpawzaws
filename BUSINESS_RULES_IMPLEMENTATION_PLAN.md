# Business Rules & Implementation Plan
## Production-Ready Enterprise Architecture Alignment

**Date:** 2025  
**Status:** Analysis & Gap Identification Complete  
**Next:** Implementation Phase

---

## Executive Summary

This document maps the 10 business rules to the current architecture, identifies gaps, and provides a production-ready implementation plan. The analysis confirms that **most UI and capabilities are built** - we need **wireframe integration and gap fixes** to achieve enterprise readiness.

### Key Findings
- ✅ **Role Configuration System:** Fully implemented and working
- ✅ **Service Catalog:** Admin-managed, vendor-consumed system exists
- ✅ **45 Capabilities:** Most have CRUD operations implemented
- ⚠️ **Booking Flow Dispatcher:** Missing unified dispatcher
- ⚠️ **Design System:** Needs application of WARMPAWZ design guidelines
- ⚠️ **Mobile/Web Parity:** Some flows differ between mobile and web
- ⚠️ **Schedule Management:** Separate systems exist but need unification

---

## Business Rules Mapping

### Rule 1: Dynamic Capabilities from Role Configuration ✅

**Requirement:** Vendors get dynamic capabilities from role configuration. 45 capabilities are individual yet wired with vendor dashboard based on role configuration.

**Current State:**
- ✅ Role configuration system exists (`role-config-endpoints.tsx`)
- ✅ `useVendorCapabilities` hook fetches capabilities dynamically
- ✅ Vendor dashboard renders capabilities conditionally
- ✅ 45 capabilities defined in `VendorCapabilities` interface

**Gaps:**
- ⚠️ Some capabilities missing full CRUD (already addressed in Phase 2)
- ⚠️ Need to ensure all capabilities are properly wired to dashboard

**Action Items:**
1. ✅ Verify all 45 capabilities have CRUD operations (Phase 2 complete)
2. ⚠️ Add capability-specific navigation handlers in `VendorDashboard.tsx`
3. ⚠️ Ensure capability components receive proper props

---

### Rule 2: Service Catalog Management ✅

**Requirement:** Service catalog on admin for all service styles (at home, at center, tele). Services consumed by staff and center. Specialization attached to problem grid search on services dashboard.

**Current State:**
- ✅ Service catalog API exists (`vendor-catalog-api-v2.tsx`)
- ✅ Admin can create/update catalog services
- ✅ Vendors can browse and add services from catalog (`VendorServiceCatalogView.tsx`)
- ✅ Services have `applicableRoles` and `serviceStyle` fields
- ✅ Problem grid search exists (`ProblemGridSelector.tsx`)
- ✅ Specialization search exists (`universal-staff-problem-search.tsx`)

**Gaps:**
- ⚠️ Problem grid needs to show specialization-based results more prominently
- ⚠️ Service catalog filtering by specialization needs enhancement
- ⚠️ Staff service assignment from catalog needs better UI

**Action Items:**
1. Enhance `ProblemGridSelector` to show specialization matches
2. Add specialization filter to `VendorServiceCatalogView`
3. Improve staff service assignment flow

---

### Rule 3: Policies in Payments & Refund Tab ✅

**Requirement:** Policies are defined in Payments & Refund tab on admin portal.

**Current State:**
- ✅ Admin portal has payment/refund management
- ✅ `SupportCRM.tsx` handles refunds
- ⚠️ Policy management component exists but needs verification

**Gaps:**
- ⚠️ Need to verify policy CRUD in admin portal
- ⚠️ Policies need to be applied to booking flows

**Action Items:**
1. Verify `VendorPolicyManagement.tsx` is accessible from admin
2. Ensure policies are enforced in booking cancellation/refund flows
3. Add policy display in booking confirmation screens

---

### Rule 4: E-commerce Flows Separate ✅

**Requirement:** E-commerce flows are separate with shop hook on services list as well as cart tab on customer mobile app and web.

**Current State:**
- ✅ Shop dashboard exists (`ShopDashboard.tsx`)
- ✅ Cart system exists (`ShoppingCartView.tsx`, `useCart` hook)
- ✅ Checkout flow exists (`CheckoutView.tsx`)
- ✅ Order management exists (`OrderHistoryPage.tsx`, `OrderDetailView.tsx`)

**Gaps:**
- ⚠️ Need to verify shop hook integration in services list
- ⚠️ Cart tab needs to be accessible from all service screens

**Action Items:**
1. Add "Add to Cart" buttons in service detail pages
2. Ensure cart tab is visible in customer app navigation
3. Verify cart persistence across sessions

---

### Rule 5: Solo vs Center Vendor Types ✅

**Requirement:** Vendor has solo as well as center selection. Center comes with center profile creation, staff, and other capabilities attached in role configuration. Solo has minimum capabilities to select role-specific services from service catalog and enable with complete booking lifecycle, revenue, earning, and payouts.

**Current State:**
- ✅ Vendor onboarding supports solo/center selection
- ✅ Center profile creation exists (`FacilityManagement.tsx`)
- ✅ Staff management exists (`StaffManagement.tsx`)
- ✅ Solo provider service selection exists (`VendorServiceCatalogView.tsx`)
- ✅ Booking lifecycle exists for both types
- ⚠️ Revenue/earnings/payouts need verification

**Gaps:**
- ⚠️ Solo provider flow needs simplification
- ⚠️ Center capabilities need better organization
- ⚠️ Revenue tracking needs verification

**Action Items:**
1. Simplify solo provider onboarding flow
2. Ensure center capabilities are properly grouped
3. Verify revenue/earnings/payouts endpoints

---

### Rule 6: Schedule Management Separation ✅

**Requirement:** Schedule management is separate for center and staff. Staff needs to list, assign, and take staff schedule using universal schedule management.

**Current State:**
- ✅ Center schedule management exists (`CenterAvailabilityManager.tsx`)
- ✅ Staff schedule management exists (`StaffScheduleManagement.tsx`, `StaffAvailabilityManagement.tsx`)
- ✅ Universal schedule utilities exist (`schedule-utils.tsx`)
- ✅ Staff availability endpoints exist (`staff-availability-routes.tsx`)

**Gaps:**
- ⚠️ Need to ensure staff can view/accept assigned schedules
- ⚠️ Center schedule assignment to staff needs better UI

**Action Items:**
1. Add staff schedule acceptance flow
2. Improve center-to-staff schedule assignment UI
3. Add schedule conflict detection

---

### Rule 7: Service Flows from Customer App ✅

**Requirement:** All service flows are from customer mobile app and web on landing page and all services. Specific dashboard has multiple options and below flows have to wire with business logic.

**Current State:**
- ✅ Customer landing pages exist for all services
- ✅ Service routers exist (`VetServiceRouter.tsx`, `GroomingServiceRouter.tsx`, etc.)
- ✅ Problem grid integration exists
- ✅ Service discovery flows exist

**Gaps:**
- ❌ **CRITICAL:** Missing unified booking flow dispatcher
- ⚠️ Service style filter (Center | Home | Tele | Delivery | Package) needs enhancement
- ⚠️ Elastic search results need better organization

**Action Items:**
1. **HIGH PRIORITY:** Create `BookingFlowDispatcher.tsx`
2. Enhance service style filtering
3. Improve elastic search result display

---

### Rule 8: Vendor CRUD for All Capabilities ✅

**Requirement:** Vendor should have CRUD implemented all over 45 capabilities and dynamically should load on vendor dashboard to make capable of delivering or configuring services, schedule for center and staff both wherever applicable.

**Current State:**
- ✅ Phase 2 completed CRUD for 37+ capabilities
- ✅ Dynamic loading works via `useVendorCapabilities`
- ✅ Vendor dashboard conditionally renders capabilities
- ✅ Schedule management exists for both center and staff

**Gaps:**
- ⚠️ Some capabilities may need additional CRUD operations
- ⚠️ Need to verify all capabilities are accessible from dashboard

**Action Items:**
1. Audit remaining capabilities for complete CRUD
2. Ensure all capability components are accessible from dashboard
3. Add capability-specific quick actions

---

### Rule 9: Specialized Vendor Capabilities ✅

**Requirement:** There are specialized vendor capabilities apart from the same capabilities individually tied to specific roles. For example, pet ambulance is a role for ambulance but again ambulance is also part of pet clinic. When ambulance is being searched by customer app should display both in search.

**Current State:**
- ✅ Specialized capabilities exist (e.g., `ambulance_services` for clinics)
- ✅ Role-based capability assignment works
- ✅ Search includes role-based results
- ⚠️ Specialized capability search needs enhancement

**Gaps:**
- ⚠️ Search results need to show both role-specific and specialized capabilities
- ⚠️ Need to highlight specialized capabilities in search

**Action Items:**
1. Enhance search to include specialized capabilities
2. Add visual indicators for specialized vs role-based services
3. Improve search result ranking

---

### Rule 10: Mobile/Web Parity with Design Guidelines ⚠️

**Requirement:** Web apps for customer and vendor have advance features. Adopt for mobile apps first with exact same flows. Make sure to have identical flows across yet customer mobile apps has the advance design guidelines as per attached guidelines without any options left on dashboard or flows.

**Current State:**
- ✅ Customer web app has advanced features
- ✅ Mobile app has basic flows
- ❌ Design system not applied
- ⚠️ Flows differ between mobile and web

**Gaps:**
- ❌ **CRITICAL:** Design system not implemented
- ⚠️ Mobile flows need to match web flows
- ⚠️ Some dashboard options missing in mobile

**Action Items:**
1. **HIGH PRIORITY:** Implement WARMPAWZ design system
2. Align mobile flows with web flows
3. Ensure all dashboard options are present

---

## Booking Flow Analysis

### Current Booking Flows

1. **Vet/Clinic Booking** ✅
   - Flow: Landing → Problem Grid → Vendor Discovery → Clinic Profile → Service Selection → Doctor Selection → Schedule → Payment → Confirmation
   - Status: Fully implemented

2. **Grooming Booking** ✅
   - Flow: Landing → Problem Grid → Vendor Discovery → Center/Home Selection → Service Selection → Schedule → Payment → Confirmation
   - Status: Fully implemented

3. **Training Booking** ✅
   - Flow: Landing → Problem Grid → Vendor Discovery → Center/Home Selection → Service Selection → Schedule → Payment → Confirmation
   - Status: Fully implemented

4. **Home Services** ⚠️
   - Flow: Service List → Provider Selection → Session Type → Schedule → Payment → GPS Tracking → Service In Progress → Completed
   - Status: Partially implemented (GPS tracking exists)

5. **Tele Consultation** ⚠️
   - Flow: Tele Service List → Instant/Scheduled → Available Staff → Payment → Video Call
   - Status: Partially implemented (video call integration needed)

6. **Delivery Flow** ⚠️
   - Flow: Service/Product Selection → Prescription Validation → Delivery Slot → Payment → GPS Tracking → Delivered
   - Status: Partially implemented (delivery tracking exists)

7. **Package & Subscription** ✅
   - Flow: Package Listing → Package Detail → Schedule Framework → Payment → Session Tracker → Completed
   - Status: Fully implemented

8. **Pet Cafe** ✅
   - Flow: Cafe Listing → Cafe Detail → Date/Time Selection → Table Selection → Confirm → Visit Completed
   - Status: Fully implemented

9. **Pet Boarding/Resort** ✅
   - Flow: Resort Listing → Resort Detail → Date Selection → Room Availability → Pre-Check Form → Payment → Check-in → Stay → Check-out
   - Status: Fully implemented

10. **Pet Insurance** ⚠️
    - Flow: Insurance Plans → Plan Detail → Upload Documents → Payment → Policy Issued → Claim Filing → Settlement
    - Status: Partially implemented (claims management exists)

11. **Staff & Vendor Side** ✅
    - Flow: New Booking → Accept/Auto Assign → Schedule Appears → Service Execution → Completion → Settlement
    - Status: Fully implemented

### Missing: Unified Booking Flow Dispatcher ❌

**Required Flow:**
```
[App Home] 
  ↓
[Search Bar / Category Tiles]
  ↓
[Problem / Intent Selection]
  ↓
[Service Style Filter] (Center | Home | Tele | Delivery | Package)
  ↓
[Elastic Search Results] (Centres | Vendors | Staff | Past Providers)
  ↓
[Service Detail Page]
  ↓
[Booking Flow Dispatcher] ← MISSING
  ↓
[Appropriate Booking Flow]
```

**Action Items:**
1. Create `BookingFlowDispatcher.tsx` component
2. Integrate with all service routers
3. Add service style filter component
4. Enhance elastic search

---

## Design System Implementation

### WARMPAWZ Design Guidelines

**Colors:**
- Primary Orange: `#FF8C42`
- Black: `#000000`
- White: `#FFFFFF`
- Primary Blue: `#3348FF`
- Light Blue: `#D9EBFF`
- Primary Green: `#00C30C`
- Light Green: `#EDFFEE`
- Primary Purple: `#9747FF`
- Light Purple: `#F3EAFF`

**Typography:**
- Font Family: Baloo 2
- Weights:
  - Regular (400): Body text
  - Medium (500): Highlight text
  - Semi-Bold (600): Subheading text
  - Bold (700): Major heading
  - Extra Bold (800): Emphasis

**Components:**
- Buttons: Primary (orange), Secondary (white with border), Icon buttons
- Navigation: Bottom nav bars with 4 items
- Cards: Service cards, vendor cards with active/inactive states
- Inputs: Rounded corners, clear labels
- Toggles: Orange for active, gray for inactive

**Action Items:**
1. Create `design-system.ts` with color constants
2. Create `typography.ts` with font definitions
3. Update all button components to use design system
4. Update navigation bars to match design
5. Apply design system to all customer app components
6. Apply design system to all vendor app components

---

## Implementation Roadmap

### Phase 1: Critical Gaps (Week 1-2)

#### 1.1 Booking Flow Dispatcher
- [ ] Create `BookingFlowDispatcher.tsx`
- [ ] Integrate with all service routers
- [ ] Add service style filter
- [ ] Test all booking flows

#### 1.2 Design System
- [ ] Create design system constants
- [ ] Update button components
- [ ] Update navigation components
- [ ] Apply to customer app
- [ ] Apply to vendor app

#### 1.3 Mobile/Web Parity
- [ ] Audit web app features
- [ ] Identify missing mobile features
- [ ] Implement missing features
- [ ] Test flow consistency

### Phase 2: Enhancements (Week 3-4)

#### 2.1 Service Catalog Enhancements
- [ ] Add specialization filtering
- [ ] Improve staff service assignment
- [ ] Enhance problem grid search

#### 2.2 Schedule Management
- [ ] Add staff schedule acceptance
- [ ] Improve center-to-staff assignment
- [ ] Add conflict detection

#### 2.3 Search & Discovery
- [ ] Enhance elastic search
- [ ] Add specialized capability search
- [ ] Improve result ranking

### Phase 3: Polish & Testing (Week 5-6)

#### 3.1 Testing
- [ ] End-to-end flow testing
- [ ] Cross-platform testing
- [ ] Performance testing

#### 3.2 Documentation
- [ ] Update API documentation
- [ ] Create user guides
- [ ] Document design system

---

## File Structure for New Components

```
src/
├── components/
│   ├── customer/
│   │   ├── BookingFlowDispatcher.tsx          ← NEW
│   │   ├── ServiceStyleFilter.tsx              ← NEW
│   │   └── EnhancedElasticSearch.tsx         ← NEW
│   ├── shared/
│   │   ├── design-system/
│   │   │   ├── colors.ts                      ← NEW
│   │   │   ├── typography.ts                  ← NEW
│   │   │   ├── buttons.tsx                    ← NEW
│   │   │   └── navigation.tsx                ← NEW
│   │   └── schedule/
│   │       ├── StaffScheduleAcceptance.tsx    ← NEW
│   │       └── ScheduleConflictDetector.tsx  ← NEW
```

---

## Success Criteria

### Functional
- ✅ All 45 capabilities have full CRUD
- ✅ All booking flows work end-to-end
- ✅ Mobile and web flows are identical
- ✅ Design system applied consistently

### Technical
- ✅ No orphaned components
- ✅ All endpoints connected to UI
- ✅ Consistent error handling
- ✅ Proper loading states

### User Experience
- ✅ Intuitive navigation
- ✅ Consistent design language
- ✅ Fast performance
- ✅ Accessible interface

---

## Next Steps

1. **Immediate:** Review this document and approve implementation plan
2. **Week 1:** Start Phase 1 (Critical Gaps)
3. **Week 2:** Complete Phase 1, start Phase 2
4. **Week 3-4:** Complete Phase 2
5. **Week 5-6:** Complete Phase 3 (Polish & Testing)

---

## Notes

- Most UI and capabilities are already built
- Focus on wireframe integration and gap fixes
- Design system application is critical for brand consistency
- Mobile/Web parity ensures consistent user experience
- Booking flow dispatcher is the missing piece for unified experience

