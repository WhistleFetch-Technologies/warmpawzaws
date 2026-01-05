/**
 * ============================================================================
 * UNIVERSAL STAFF PROBLEM SEARCH - SQL-ONLY VERSION
 * ============================================================================
 *
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 *
 * CORRECT APPROACH:
 * 1. First search ALL staff with minimum 1 active and published service
 * 2. Then check if their specialization matches the problem grid
 * 3. Show doctors list and associated clinic dynamically for all roles/vendors
 *
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.getByPrefix()` with SQL queries
 * - Uses `StaffRepository`, `VendorsRepository`, `ServicesRepository`
 * - Uses `staff`, `vendors`, `staff_services`, `vendor_services`, `staff_specializations` tables
 *
 * Date: 2025-01-28
 * Migration: Batch 10 Phase 1 - KV to SQL (7 KV operations removed)
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function universalStaffProblemSearchSQL(mainApp: Hono): void;
export default universalStaffProblemSearchSQL;
//# sourceMappingURL=universal-staff-problem-search-sql.d.ts.map