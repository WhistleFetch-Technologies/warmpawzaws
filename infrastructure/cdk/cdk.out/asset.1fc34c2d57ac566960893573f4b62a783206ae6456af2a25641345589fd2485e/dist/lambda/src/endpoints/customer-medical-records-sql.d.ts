/**
 * CUSTOMER MEDICAL RECORDS UPLOAD (SQL-ONLY VERSION)
 *
 * Features:
 * - Upload medical documents (prescriptions, lab reports, x-rays)
 * - Vaccination certificate upload
 * - Pet photo upload
 * - Document categorization
 * - Secure storage with Supabase
 * - Document sharing with vets
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()` with SQL repository calls
 * - All data now comes from SQL tables (pets, medical_documents, document_shares)
 *
 * Date: 2025-01-27
 * Migration: Batch 8 - Complete KV to SQL Migration
 * Status: ✅ P1 IMPLEMENTATION
 */
import { Hono } from "hono";
export declare function registerCustomerMedicalRecordsEndpointsSQL(app: Hono): void;
//# sourceMappingURL=customer-medical-records-sql.d.ts.map