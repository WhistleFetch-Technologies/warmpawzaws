# Complete KV to SQL Migration Plan

**Date**: 2025-01-22  
**Goal**: 100% SQL-based, 0 KV operations, 100% test coverage

## Executive Summary

This document outlines the complete migration strategy from KV store to SQL for all 5,150+ operations across 309 endpoint files.

## Migration Status

### ✅ Phase 1: Foundation (COMPLETED)
- [x] SQL schema created with all necessary tables
- [x] Database client (`db.ts`) with transaction support
- [x] Repository pattern established
- [x] Payment endpoints migrated to SQL
- [x] Migration SQL script created

### 🔄 Phase 2: Critical Financial Operations (IN PROGRESS)
- [x] Payment processing (SQL-based)
- [ ] Payout processing (needs migration)
- [ ] Settlement automation (needs migration)
- [ ] Wallet operations (needs migration)

### ⏳ Phase 3: Core Business Logic (PENDING)
- [ ] Booking creation & lifecycle
- [ ] Service discovery
- [ ] Role & capability system
- [ ] Service publishing

### ⏳ Phase 4: Supporting Systems (PENDING)
- [ ] E-commerce (orders, cart, products)
- [ ] Coupons & promotions
- [ ] Notifications (can use bridge)
- [ ] Analytics

### ⏳ Phase 5: Admin & Reporting (PENDING)
- [ ] Admin endpoints
- [ ] Reporting & analytics
- [ ] Audit logging

## Implementation Strategy

### Step 1: Use Adapter Pattern
The `kv-to-sql-adapter.ts` provides a bridge that:
- Routes KV operations to SQL when data exists
- Falls back to KV during migration
- Allows gradual migration without breaking existing code

### Step 2: Migrate Endpoints Systematically
For each endpoint file:
1. Create SQL-based version (`*-sql.tsx`)
2. Update repository if needed
3. Register in `index.tsx`
4. Test thoroughly
5. Remove KV version once verified

### Step 3: Add Tests
Create comprehensive test suite for:
- Payment flows
- Booking flows
- Payout flows
- Service discovery
- Capability enforcement

## Critical Files to Migrate (Priority Order)

### Tier 1: Financial (CRITICAL)
1. ✅ `payment-endpoints.tsx` → `payment-endpoints-sql.tsx` (DONE)
2. ⏳ `payout-cron-job.tsx` → `payout-cron-job-sql.tsx`
3. ⏳ `settlement-automation.tsx` → `settlement-automation-sql.tsx`
4. ⏳ `automated-payout-processing.tsx` → `automated-payout-processing-sql.tsx`

### Tier 2: Core Operations (HIGH)
5. ⏳ `booking-creation.tsx` → `booking-creation-sql.tsx`
6. ⏳ `booking-lifecycle-complete.tsx` → `booking-lifecycle-complete-sql.tsx`
7. ⏳ `customer-services.tsx` → `customer-services-sql.tsx`
8. ⏳ `vendor-service-management.tsx` → `vendor-service-management-sql.tsx`

### Tier 3: Role & Capabilities (HIGH)
9. ⏳ `rbac-endpoints.tsx` → `rbac-endpoints-sql.tsx`
10. ⏳ `role-config-endpoints.tsx` → `role-config-endpoints-sql.tsx`
11. ⏳ `capability-endpoints.tsx` → `capability-endpoints-sql.tsx`

### Tier 4: Supporting (MEDIUM)
12. ⏳ `wallet-endpoints.tsx` → `wallet-endpoints-sql.tsx`
13. ⏳ `order-management-endpoints.tsx` → `order-management-endpoints-sql.tsx`
14. ⏳ `promotion-endpoints.tsx` → `promotion-endpoints-sql.tsx`

## Testing Strategy

### Unit Tests
- Repository tests for each data access layer
- Service tests for business logic
- Endpoint tests for API handlers

### Integration Tests
- Complete payment flow
- Complete booking flow
- Complete payout flow
- Service discovery flow

### E2E Tests
- Customer booking journey
- Vendor payout journey
- Admin operations

## Success Criteria

- [ ] 0 KV operations in production code
- [ ] 100% SQL-based data access
- [ ] All tests passing (100% pass rate)
- [ ] All flows complete (100% coverage)
- [ ] Zero critical/high/medium issues
- [ ] Zero missing features

## Next Steps

1. Complete payout endpoint migration
2. Complete booking endpoint migration
3. Complete service discovery migration
4. Add comprehensive test suite
5. Verify 100% SQL compliance

