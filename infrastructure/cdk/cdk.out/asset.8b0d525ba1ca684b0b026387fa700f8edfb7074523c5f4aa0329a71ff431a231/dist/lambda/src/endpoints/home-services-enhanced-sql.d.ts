/**
 * ============================================================================
 * HOME SERVICES ENHANCEMENTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - Previous providers tracking & carousel
 * - Radar map view with geospatial queries
 * - Multi-service scheduling with buffer time
 * - Commute time calculation
 * - Service radius configuration
 * - Package time windows (morning/afternoon/evening)
 * - Coverage area management
 *
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - Uses `BookingsRepository`, `VendorsRepository`
 *
 * Date: 2025-01-27
 * Migration: Phase 3 - Services Entity Migration
 * KV Operations Removed: 5
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function homeServicesEnhancedSQL(mainApp: Hono): void;
export default homeServicesEnhancedSQL;
//# sourceMappingURL=home-services-enhanced-sql.d.ts.map