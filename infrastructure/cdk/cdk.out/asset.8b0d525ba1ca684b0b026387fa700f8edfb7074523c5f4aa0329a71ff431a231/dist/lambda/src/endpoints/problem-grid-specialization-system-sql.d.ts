/**
 * ============================================================================
 * PROBLEM GRID SPECIALIZATION SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - Get problem grid specializations by role
 * - Update vendor specializations
 * - Update staff specializations
 * - Find vendors/staff by specialization
 *
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Vendors from `vendors` table
 * - Vendor specializations from `vendor_specializations` table
 * - Staff from `staff` table
 * - Staff specializations from `staff_specializations` table
 *
 * Date: 2025-01-27
 * Migration: Batch 7 Phase 4 - KV to SQL
 * ============================================================================
 */
import { Hono } from "hono";
/**
 * PROBLEM GRID SPECIALIZATION SYSTEM - SQL-ONLY
 */
export declare function registerProblemGridSpecializationSystem(app: Hono): void;
export default registerProblemGridSpecializationSystem;
//# sourceMappingURL=problem-grid-specialization-system-sql.d.ts.map