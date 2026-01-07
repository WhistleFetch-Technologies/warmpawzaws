/**
 * ============================================================================
 * SERVICE COMPARISON SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - Compare multiple services side-by-side
 * - Compare multiple vendors
 * - Compare multiple staff members
 * - Comparison criteria customization
 * - Save comparison results
 * - Share comparison with others
 *
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()` with SQL repository calls
 * - Uses `ServicesRepository`, `VendorsRepository`, `BookingsRepository`
 * - Uses `customer_comparisons` table or `platform_settings` for saved comparisons
 *
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL (Batch 8)
 * KV Operations Removed: 9
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function serviceComparisonSystemSQL(mainApp: Hono): void;
export default serviceComparisonSystemSQL;
//# sourceMappingURL=service-comparison-system-sql.d.ts.map