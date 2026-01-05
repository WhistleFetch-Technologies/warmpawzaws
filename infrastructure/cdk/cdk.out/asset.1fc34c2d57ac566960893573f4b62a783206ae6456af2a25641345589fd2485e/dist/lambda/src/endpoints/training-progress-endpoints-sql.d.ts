/**
 * ============================================================================
 * TRAINING PROGRESS ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Complete progress tracking system for pet training
 *
 * Features:
 * - Session-by-session progress tracking
 * - Milestone management
 * - Outcome recording with notes
 * - Before/after comparison
 * - Progress photos/videos
 * - Performance graphs data
 * - Completion certificates
 *
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All data now comes from SQL tables
 *
 * Date: 2025-01-27
 * Migration: Phase 6 - Complete KV to SQL Migration
 * ============================================================================
 */
import { Hono } from "hono";
export declare function trainingProgressEndpoints(app: Hono): void;
//# sourceMappingURL=training-progress-endpoints-sql.d.ts.map