# SYSTEMATIC KV TO SQL MIGRATION PLAN

**Date:** 2025-01-27  
**Objective:** Migrate ALL in-use files from KV to SQL, discard orphaned files

---

## PHASE 1: ANALYSIS & CLASSIFICATION

### Step 1: Identify Files with KV Usage ✅
- All files with `kv.get`, `kv.set`, `kv.del`, `kv.getByPrefix` calls
- Exclude backup files and kv_store.tsx itself

### Step 2: Classify Files
- **IN_USE**: Imported/registered in index.tsx or referenced elsewhere
- **ORPHANED**: Not imported anywhere, safe to discard

### Step 3: Prioritize In-Use Files
- Priority 1: Registered in index.tsx with `(app, kv)` parameter
- Priority 2: Imported but not yet migrated
- Priority 3: Referenced in other files

---

## PHASE 2: MIGRATION STRATEGY

### For Each In-Use File:
1. Analyze KV usage patterns
2. Create/identify SQL tables/repositories needed
3. Create SQL-migrated version (`-sql.tsx`)
4. Update index.tsx import and registration (remove `kv` parameter)
5. Verify zero KV usage
6. Delete old KV-based file (or keep as backup)

### Batch Processing:
- Process 5-10 files at a time
- Group similar patterns together (e.g., analytics, notifications)
- Reuse repositories/tables where possible

---

## PHASE 3: CLEANUP

### Discard Orphaned Files:
1. Verify file is truly orphaned (no imports, no references)
2. Move to archive or delete
3. Document what was removed

---

## EXECUTION PLAN

### Batch 1: High-Priority Endpoints (Registered in index.tsx)
1. ✅ resort-precheck-endpoints.tsx
2. ✅ resort-inventory.tsx
3. training-progress-endpoints.tsx (re-migrate, user reverted)
4. pet-profile-publishing-endpoints.tsx
5. delivery-integration-endpoints.tsx
6. notification-template-system.tsx
7. specialized-vendor-config-endpoints.tsx
8. backwards-compatible-endpoints.tsx
9. analytics-dashboard-endpoints.tsx
10. performance-monitoring-endpoints.tsx

### Batch 2: System & Infrastructure
- system-optimization-endpoints.tsx
- elasticsearch-core-endpoints.tsx
- advanced-search-api.tsx
- search-analytics-api.tsx
- elasticsearch-integration.tsx
- elasticsearch-proxy-endpoints.tsx

### Batch 3: Nutritionist & Food Services
- nutritionist-system-endpoints.tsx
- nutritionist-diet-plan-endpoints.tsx
- nutritionist-food-integration-endpoints.tsx
- nutritionist-food-delivery-endpoints.tsx
- food-delivery-hyperlocal-endpoints.tsx

### Batch 4: Marketplace & Payments
- marketplace-settlement-enhanced.tsx
- razorpay-marketplace-settlement.tsx
- tier-system-integration.tsx
- tier-commission-integration-endpoints.tsx
- settlement-tier-system-endpoints.tsx

### Batch 5: Services & Discovery
- integrated-services-endpoints.tsx
- integrated-services-manager-endpoints.tsx
- unified-service-discovery-endpoints.tsx
- services-by-problem-endpoints.tsx
- previous-providers-endpoints.tsx

### Batch 6: Scheduling & Logistics
- multi-service-scheduling-endpoints.tsx
- time-window-subscription-endpoints.tsx
- logistics-partner-integration-endpoints.tsx
- radar-location-system-endpoints.tsx

### Batch 7: Other Services
- sms-notification-service-enhanced.tsx
- automated-bank-verification-endpoints.tsx
- rescheduling-policies-endpoints.tsx
- refund-policy-endpoints.tsx
- independent-vendor-system-endpoints.tsx

### Batch 8: Remaining Files
- All other in-use files identified
- Process remaining systematically

### Batch 9: Cleanup
- Identify and discard orphaned files
- Archive documentation

---

## PROGRESS TRACKING

**Total Files with KV:** ~250  
**In-Use Files:** TBD  
**Orphaned Files:** TBD  
**Completed:** 17 files  
**Remaining:** TBD

---

## NOTES

- Some files may share similar patterns (batch together)
- Some may not need new tables (reuse existing)
- Continue until zero tasks remain
- No reviews needed, execute systematically

