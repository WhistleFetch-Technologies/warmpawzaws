/**
 * ============================================================================
 * TELE-CONSULTATION ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - Video call initiation
 * - Call acceptance/rejection
 * - Call management (end call)
 * - Session management
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ No loose strings - use constants
 * ✅ Proper error handling
 * ✅ CRUD operations via repositories
 *
 * Date: 2025-01-27
 * Migration: Phase 2 - Critical Flow Migration
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function teleConsultationEndpoints(app: Hono): void;
//# sourceMappingURL=tele-consultation-endpoints-sql.d.ts.map