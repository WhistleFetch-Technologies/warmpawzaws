/**
 * ============================================================================
 * REPORTS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles report generation and management:
 * - Generate reports (revenue, bookings, vendors, customers)
 * - Save report configurations
 * - Export reports
 *
 * Migrated from: supabase/functions/make-server-3dd53475/report-builder-endpoints-sql.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerReportEndpoints(app: Hono): void;
//# sourceMappingURL=reports.d.ts.map