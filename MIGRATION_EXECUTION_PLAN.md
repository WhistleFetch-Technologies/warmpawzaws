# MIGRATION EXECUTION PLAN

**Date:** 2025-01-27  
**Strategy:** Systematic migration of in-use files, discard orphaned files

---

## ANALYSIS RESULTS

**Total Files with KV Usage:** 249  
**Files Registered in index.tsx with (app, kv):** ~39 endpoints  
**Files to Migrate (in-use):** TBD (analyzing now)  
**Orphaned Files:** TBD (will identify after migration)

---

## MIGRATION PRIORITY ORDER

Based on files registered with `(app, kv)` in index.tsx:

### Batch 1: Core Features (High Priority)
1. ✅ resort-precheck-endpoints.tsx (DONE)
2. ✅ resort-inventory.tsx (DONE)
3. training-progress-endpoints.tsx (RE-MIGRATE - user reverted)
4. pet-profile-publishing-endpoints.tsx
5. delivery-integration-endpoints.tsx
6. notification-template-system.tsx
7. specialized-vendor-config-endpoints.tsx
8. backwards-compatible-endpoints.tsx

### Batch 2: Analytics & Monitoring
9. analytics-dashboard-endpoints.tsx
10. performance-monitoring-endpoints.tsx
11. system-optimization-endpoints.tsx

### Batch 3: Search & Discovery
12. elasticsearch-core-endpoints.tsx
13. advanced-search-api.tsx
14. search-analytics-api.tsx
15. elasticsearch-integration.tsx
16. elasticsearch-proxy-endpoints.tsx

### Batch 4: Nutritionist Services
17. nutritionist-system-endpoints.tsx
18. nutritionist-diet-plan-endpoints.tsx
19. nutritionist-food-integration-endpoints.tsx
20. nutritionist-food-delivery-endpoints.tsx
21. food-delivery-hyperlocal-endpoints.tsx

### Batch 5: Marketplace & Payments
22. marketplace-settlement-enhanced.tsx
23. razorpay-marketplace-settlement.tsx
24. tier-system-integration.tsx
25. tier-commission-integration-endpoints.tsx
26. settlement-tier-system-endpoints.tsx

### Batch 6: Services & Integration
27. integrated-services-endpoints.tsx
28. integrated-services-manager-endpoints.tsx
29. unified-service-discovery-endpoints.tsx
30. services-by-problem-endpoints.tsx
31. previous-providers-endpoints.tsx

### Batch 7: Scheduling & Logistics
32. multi-service-scheduling-endpoints.tsx
33. time-window-subscription-endpoints.tsx
34. logistics-partner-integration-endpoints.tsx
35. radar-location-system-endpoints.tsx
36. independent-vendor-system-endpoints.tsx

### Batch 8: Other Services
37. sms-notification-service-enhanced.tsx
38. automated-bank-verification-endpoints.tsx
39. rescheduling-policies-endpoints.tsx
40. refund-policy-endpoints.tsx

---

## EXECUTION STRATEGY

For each file:
1. Read and analyze KV usage
2. Identify required SQL tables/repositories
3. Create migration SQL if needed
4. Create repository if needed
5. Create SQL-migrated endpoint file
6. Update index.tsx (remove kv parameter)
7. Verify zero KV usage
8. Mark complete

After all in-use files migrated:
1. Identify truly orphaned files (no imports anywhere)
2. Archive or delete orphaned files
3. Final verification

---

## PROGRESS TRACKING

**Completed:** 2 files  
**In Progress:** 0  
**Remaining:** ~37 files  
**Status:** Starting Batch 1, Task 3 (training-progress re-migration)
