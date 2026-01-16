# Dashboard Enhancement Plan
## Replace Placeholder Sections with Functional Components

**Date:** 2026-01-28  
**Status:** ⚠️ **IN PROGRESS**  
**Goal:** Replace 39 placeholder sections in `VendorCapabilityDashboard.tsx` with functional components

---

## CURRENT STATUS

### ✅ Implemented Sections (17)
1. `services` - ServicesSection (FULL)
2. `staff` - StaffSection (FULL)
3. `bookings` - BookingsSection (FULL)
4. `earnings` - EarningsSection (FULL)
5. `schedule` - ScheduleSection (PLACEHOLDER - needs enhancement)
6. `profile` - ProfileSection (FULL)
7. `cafe_tables` - CafeTablesSection (PLACEHOLDER)
8. `rooms` - RoomsSection (PLACEHOLDER)
9. `insurance_plans` - InsurancePlansSection (PLACEHOLDER)
10. `adoption` - AdoptionSection (PLACEHOLDER)
11. `meal_plans` - MealPlansSection (PLACEHOLDER)
12. `walking` - WalkingSection (PLACEHOLDER)
13. `ambulance` - AmbulanceSection (PLACEHOLDER)
14. `diagnostics` - DiagnosticsSection (PLACEHOLDER)
15. `holiday_packages` - HolidaysSection (PLACEHOLDER)
16. `products` - ProductsSection (PLACEHOLDER)
17. `training_programs` - TrainingSection (PLACEHOLDER)

### ⚠️ Placeholder Sections (10+ specialized placeholders + ~29 default placeholders = ~39 total)

**Specialized Placeholders (using `SpecializedPlaceholder` component):**
- cafe_tables
- rooms
- insurance_plans
- adoption
- meal_plans
- walking
- ambulance
- diagnostics
- holiday_packages
- products
- training_programs

**Default Placeholders (show "Coming soon..."):**
All other capabilities not in the implemented list show the default placeholder.

---

## ENHANCEMENT STRATEGY

### Phase 1: Replace Specialized Placeholders (11 sections)
Replace `SpecializedPlaceholder` components with functional sections that:
1. Load data from APIs
2. Display summaries/statistics
3. Provide "View All" links to full pages
4. Show recent items/activities

### Phase 2: Add Functional Sections for Remaining Capabilities
For capabilities not in the list, create basic functional sections that:
1. Load relevant data
2. Display summaries
3. Link to full pages where available
4. Show empty states with "Get Started" actions

### Phase 3: Enhance Existing Sections
Improve existing sections like `ScheduleSection` to be fully functional.

---

## APPROACH

Since we've already created full pages for many capabilities, the dashboard sections should:
1. **Display summaries** - Show key metrics and recent items
2. **Link to full pages** - Provide "View All" or "Manage" buttons
3. **Load actual data** - Fetch from existing APIs
4. **Show empty states** - Guide users when no data exists

This approach provides:
- ✅ Quick overview in dashboard
- ✅ Deep dive via full pages
- ✅ Consistent user experience
- ✅ Reuse of existing API endpoints

---

## NEXT STEPS

1. Replace specialized placeholder sections one by one
2. Add functional sections for remaining capabilities
3. Test each section with real data
4. Ensure all sections link to appropriate full pages
