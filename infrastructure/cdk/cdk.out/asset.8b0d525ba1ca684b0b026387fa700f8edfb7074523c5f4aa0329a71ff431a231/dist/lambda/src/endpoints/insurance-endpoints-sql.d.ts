/**
 * ============================================================================
 * INSURANCE ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - Insurance plan browsing
 * - Policy purchase & management
 * - Document upload & verification
 * - Claim filing & tracking
 * - Premium calculation
 * - Coverage validation
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Proper error handling
 * ✅ CRUD operations via repositories
 *
 * Date: 2025-01-27
 * Migration: Phase 2 - Critical Flow Migration
 * ============================================================================
 */
import { Hono } from "hono";
export declare function insuranceEndpoints(app: Hono): void;
//# sourceMappingURL=insurance-endpoints-sql.d.ts.map