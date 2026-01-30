# UI Frame Update Checklist - Service Booking Flows

## ✅ COMPLETED - Landing Pages
- [x] PharmacyServicesLanding.tsx
- [x] NutritionistServicesLanding.tsx  
- [x] WalkerService.tsx
- [x] DiagnosticsBookingFlow.tsx
- [x] GroomingServiceRouter.tsx (already had it)
- [x] TrainingServiceRouter.tsx (already had it)

## ✅ COMPLETED - Booking Routers
- [x] VetBookingRouter.tsx (already had it)
- [x] GroomingBookingRouter.tsx (already had it)
- [x] TrainingBookingRouter.tsx (already had it)
- [x] TeleConsultationRouter.tsx (already had it)
- [x] WalkerBookingRouter.tsx (just updated)

## ✅ COMPLETED - Critical Routers
- [x] UniversalBookingRouter.tsx - **COMPLETED** (used by multiple services)
- [x] NutritionistBookingRouter.tsx - **COMPLETED** (nutritionist booking flow)

## ⚠️ TO VERIFY - Home Visit Routers
- [x] HomeVisitRouter.tsx (uses UniversalServiceProviderList which has ServiceDashboardHeader)
- [ ] GroomingHomeVisitRouter.tsx
- [ ] TrainerHomeVisitRouter.tsx

## 📋 TO CHECK - Other Service Routers
- [ ] BoardingBookingRouter.tsx
- [ ] NutritionistTeleRouter.tsx
- [ ] HomeServiceRouter.tsx
- [ ] UniversalHomeServiceRouter.tsx
- [ ] SpecializedServiceRouter.tsx

## 🎯 UPDATE PATTERN
Each router should:
1. Import ServiceDashboardHeader
2. Add header before main content (hide on payment step)
3. Use appropriate service icon and colors
4. Include stats (providers, bookings, rating)
5. Ensure payment page shows full screen without header

## ⚠️ CRITICAL CHECKS
- [ ] Payment pages hide header and show full screen
- [ ] All booking steps maintain UI frame
- [ ] Back navigation works correctly
- [ ] No API calls or functionality broken
- [ ] Mobile responsiveness maintained
