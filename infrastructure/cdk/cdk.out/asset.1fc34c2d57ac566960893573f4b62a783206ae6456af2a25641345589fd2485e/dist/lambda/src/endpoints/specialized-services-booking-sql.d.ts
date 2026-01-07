/**
 * ============================================================================
 * SPECIALIZED SERVICES BOOKING - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - Prescription management
 * - Medical records access
 * - Role-based chat
 * - Add-on services
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Specialized services metadata stored in booking.notes (JSON)
 * ✅ Proper error handling
 * ✅ CRUD operations via repositories
 *
 * Date: 2025-01-27
 * Migration: Phase 2 - Critical Flow Migration
 * ============================================================================
 */
import { Hono } from "hono";
export declare function specializedServicesBooking(app: Hono): void;
//# sourceMappingURL=specialized-services-booking-sql.d.ts.map