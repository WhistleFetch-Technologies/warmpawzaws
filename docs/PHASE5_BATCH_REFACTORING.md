# Phase 5: Batch Refactoring Plan

## Overview
Refactoring ALL remaining files from KV to SQL. This is a systematic batch operation.

## Strategy
1. **Priority Files First** (High business impact)
2. **Core Files** (Frequently used)
3. **Supporting Files** (Less critical)
4. **Utility Files** (Helper functions)

## Files Status

### ✅ Completed (7 files)
1. payment-endpoints.tsx
2. booking-endpoints.tsx
3. booking-lifecycle-complete.tsx
4. vendor-dashboard-endpoints.tsx
5. customer-routes.tsx
6. wallet-endpoints.tsx
7. vendor-onboarding.tsx

### 🔄 In Progress (Priority Files)
1. staff-crud-endpoints.tsx
2. vendor-service-management.tsx
3. analytics-endpoints.tsx

### 📋 Remaining Files (~298 files)
- See grep results for complete list
- Many files use KV operations
- Systematic refactoring required

## Approach
1. Create/update repositories as needed
2. Refactor one file at a time
3. Test after each refactoring
4. Update index.tsx to remove kv parameters
5. Commit after each batch

## Estimated Progress
- Completed: 7 files (~2.3%)
- Remaining: ~298 files (~97.7%)
- This is a large-scale migration

