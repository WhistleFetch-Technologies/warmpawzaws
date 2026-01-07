/**
 * ENHANCED STAFF AVAILABILITY WITH CONFLICT DETECTION - SQL-ONLY VERSION
 *
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 *
 * Adds missing features from handoff checklist:
 * - Conflict detection with 409 responses
 * - mode field (location vs centre)
 * - Conditional field validation (leadTime >= 30 for home)
 * - maxDistance validation
 * - Centre concurrency validation
 *
 * Date: 2025-01-27
 * Migration: KV to SQL (8 KV operations → 0)
 * Endpoints: 1
 */
import { Hono } from 'hono';
export declare function enhancedStaffAvailabilityWithConflictsSQL(mainApp: Hono): void;
export default enhancedStaffAvailabilityWithConflictsSQL;
//# sourceMappingURL=enhanced-staff-availability-with-conflicts-sql.d.ts.map