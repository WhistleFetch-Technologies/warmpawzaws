/**
 * ============================================================================
 * MEDICAL RECORDS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles medical records management:
 * - Create medical records
 * - Get medical records with access control
 * - Get records by pet
 * - Update records (with audit trail)
 *
 * Migrated from: supabase/functions/make-server-3dd53475/healthcare-compliance-endpoints.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerMedicalRecordsEndpoints(app: Hono): void;
//# sourceMappingURL=medical-records.d.ts.map