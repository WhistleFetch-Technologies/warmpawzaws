/**
 * CONSULTATION NOTES ENDPOINTS (SQL-ONLY VERSION)
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()` with SQL repository calls
 * - All data now comes from SQL tables (bookings, consultation_notes)
 *
 * Date: 2025-01-27
 * Migration: Batch 8 - Complete KV to SQL Migration
 */
import { Hono } from 'hono';
export declare function consultationNotesEndpointsSQL(app: Hono): void;
//# sourceMappingURL=consultation-notes-endpoints-sql.d.ts.map