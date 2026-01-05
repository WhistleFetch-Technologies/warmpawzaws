/**
 * CLINIC-DOCTOR MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 *
 * Multi-level vendor capability system for Vet/Clinic, Grooming Centers, Training Centers
 *
 * Two operational models:
 * 1. Independent Doctor/Trainer - Manages everything at their profile level
 * 2. Clinic/Center with Multiple Staff - Clinic manages roles, staff delivers services
 *
 * Key Features:
 * - Clinic-level: Role management, appointment overview (no service delivery)
 * - Doctor/Staff-level: Full service delivery (chat, video, prescriptions)
 * - Customer sees: Clinic → Doctor list → Book with specific doctor
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL repository calls
 * - Uses `VendorsRepository` for clinics (vendors with isClinic flag in metadata)
 * - Uses `StaffRepository` for doctors (doctors are staff members)
 * - Uses `BookingsRepository` for appointments
 * - Uses `CustomersRepository` for customers
 * - Uses `PetsRepository` for pets
 * - Uses `NotificationsRepository` for notifications
 * - Uses `platform_settings` table for doctor lookups
 *
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL (Batch 12)
 * KV Operations Removed: 45
 * ============================================================================
 */
import { Hono } from "hono";
export declare function registerClinicDoctorEndpointsSQL(app: Hono): void;
//# sourceMappingURL=clinic-doctor-endpoints-sql.d.ts.map