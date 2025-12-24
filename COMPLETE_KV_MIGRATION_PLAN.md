# COMPLETE KV TO SQL MIGRATION PLAN

**Date:** 2025-01-27  
**Status:** In Progress  
**Scope:** Migrate ALL files from KV to SQL (critical + non-critical)

---

## ✅ COMPLETED MIGRATIONS

### Critical Booking/Service Flows (14/14 - 100%)
1. ✅ Home Service Booking Flow
2. ✅ Tele Consultation Endpoints
3. ✅ Instant Tele Booking & Endpoints
4. ✅ Video Consultation Endpoints
5. ✅ Center Bookings (Vet & Grooming)
6. ✅ Customer Package Endpoints
7. ✅ Specialized Services Booking
8. ✅ Holiday Package Endpoints & System
9. ✅ Insurance Endpoints
10. ✅ Adoption Endpoints
11. ✅ Boarding Room Management
12. ✅ Cafe Features
13. ✅ **Resort Pre-Check Endpoints** (NEW - just completed)

### Infrastructure Created
- ✅ 19 SQL repositories created
- ✅ 12 database tables created
- ✅ Resort pre-check tables and repository (NEW)

---

## 📋 REMAINING MIGRATIONS (250 files identified)

### Priority 1: Actively Used Endpoints (Registered in index.tsx)

**High Priority - Core Functionality:**
1. ⏳ resort-inventory.tsx (9 KV usages)
2. ⏳ training-progress-endpoints.tsx
3. ⏳ pet-profile-publishing-endpoints.tsx
4. ⏳ delivery-integration-endpoints.tsx
5. ⏳ notification-template-system.tsx
6. ⏳ specialized-vendor-config-endpoints.tsx
7. ⏳ backwards-compatible-endpoints.tsx
8. ⏳ analytics-dashboard-endpoints.tsx
9. ⏳ performance-monitoring-endpoints.tsx
10. ⏳ system-optimization-endpoints.tsx
11. ⏳ elasticsearch-core-endpoints.tsx
12. ⏳ advanced-search-api.tsx
13. ⏳ search-analytics-api.tsx
14. ⏳ nutritionist-system-endpoints.tsx
15. ⏳ nutritionist-diet-plan-endpoints.tsx
16. ⏳ nutritionist-food-integration-endpoints.tsx
17. ⏳ nutritionist-food-delivery-endpoints.tsx
18. ⏳ food-delivery-hyperlocal-endpoints.tsx
19. ⏳ sms-notification-service-enhanced.tsx
20. ⏳ tier-system-integration.tsx
21. ⏳ marketplace-settlement-enhanced.tsx
22. ⏳ elasticsearch-integration.tsx
23. ⏳ integrated-services-endpoints.tsx
24. ⏳ previous-providers-endpoints.tsx
25. ⏳ radar-location-system-endpoints.tsx
26. ⏳ multi-service-scheduling-endpoints.tsx
27. ⏳ time-window-subscription-endpoints.tsx
28. ⏳ independent-vendor-system-endpoints.tsx
29. ⏳ unified-service-discovery-endpoints.tsx
30. ⏳ logistics-partner-integration-endpoints.tsx
31. ⏳ automated-bank-verification-endpoints.tsx
32. ⏳ tier-commission-integration-endpoints.tsx
33. ⏳ rescheduling-policies-endpoints.tsx
34. ⏳ services-by-problem-endpoints.tsx
35. ⏳ elasticsearch-proxy-endpoints.tsx
36. ⏳ refund-policy-endpoints.tsx
37. ⏳ settlement-tier-system-endpoints.tsx
38. ⏳ integrated-services-manager-endpoints.tsx
39. ⏳ razorpay-marketplace-settlement.tsx

**Medium Priority - Supporting Services:**
- Additional capabilities endpoints
- Admin catalog endpoints
- Admin integration endpoints
- Admin vendor endpoints
- Advanced filtering system
- Advanced search engine
- Agora video integration
- AI CRM routes
- Ambulance service endpoints
- Analytics aggregation
- Analytics endpoints
- Analytics events
- Appointment detail endpoints
- Appointment lifecycle endpoints
- Appointment reminder system
- Auth endpoints
- Auth middleware
- Auth service
- Auto assignment logic
- Automated bank verification
- Automated payout processing
- Automated vendor payouts
- Availability engine
- AWS Chime integrations
- Bank verification endpoints
- Booking creation
- Booking endpoints
- Booking lifecycle
- Booking management endpoints
- Booking validation endpoints
- And 200+ more files...

---

## 🎯 MIGRATION STRATEGY

### Phase 1: Complete Actively Used Endpoints (Priority 1)
1. Focus on files registered in `index.tsx` first
2. Create necessary SQL tables/repositories
3. Migrate systematically, testing after each

### Phase 2: Supporting Services (Priority 2)
1. Migrate supporting endpoints that are imported but may not be registered
2. Focus on commonly used utilities and helpers

### Phase 3: Legacy/Unused Files (Priority 3)
1. Audit which files are actually being used
2. Migrate active legacy files
3. Consider deprecating unused files

---

## 📊 PROGRESS TRACKING

**Total Files with KV Usage:** 250  
**Completed:** 14 critical + 1 new = 15  
**Remaining:** ~235

**Migration Rate Target:** 10-20 files per batch  
**Estimated Batches:** 15-25 batches

---

## 🔧 PROCESS FOR EACH FILE

1. **Analyze KV Usage:**
   - Identify all `kv.get()`, `kv.set()`, `kv.del()`, `kv.getByPrefix()` calls
   - Map KV keys to database entities
   - Identify relationships and dependencies

2. **Create Infrastructure:**
   - Create SQL migration file if tables needed
   - Create repository file
   - Update `repositories/index.ts`

3. **Migrate Endpoint File:**
   - Replace KV calls with repository calls
   - Update function signatures (remove `kv` parameter)
   - Test endpoint functionality

4. **Update Registration:**
   - Update `index.tsx` import and registration
   - Remove `kv` parameter from function calls

5. **Verify:**
   - Check for zero KV usage
   - Test endpoints
   - Update documentation

---

## 📝 NOTES

- Some files may share similar patterns (e.g., analytics endpoints)
- Batch similar files together for efficiency
- Some endpoints may not need tables (can use existing ones)
- Consider creating shared repositories for common patterns

---

**Next Steps:** Continue with resort-inventory.tsx, then systematically work through Priority 1 files.

