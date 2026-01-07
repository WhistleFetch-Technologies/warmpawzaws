/**
 * ✅ UNIVERSAL OTP SYSTEM - SQL-ONLY VERSION
 * Production-ready OTP management for all services
 *
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * KV Operations: 21 → 0
 *
 * Generates OTPs for:
 * - Vet appointments
 * - Walker sessions
 * - Grooming sessions
 * - Training sessions
 * - Boarding check-in/out
 * - Home visits
 * - Meal delivery
 *
 * Only vendor with valid OTP can mark service as completed
 */
import { Hono } from "hono";
export declare function registerUniversalOTPSystemSQL(app: Hono): void;
//# sourceMappingURL=universal-otp-system-sql.d.ts.map