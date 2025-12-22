/**
 * ============================================================================
 * REPOSITORIES INDEX
 * ============================================================================
 * 
 * Central export point for all repositories.
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All repositories use SQL only
 * 
 * Date: 2024-12-22
 * ============================================================================
 */

// Core repositories
export * from "./customers.ts";
export * from "./vendors.ts";
export * from "./bookings.ts";
export * from "./payments.ts";

// Re-export repository instances for convenience
export {
  getCustomersRepository,
  getVendorsRepository,
  getBookingsRepository,
  getPaymentsRepository,
} from "./customers.ts";
export { getVendorsRepository } from "./vendors.ts";
export { getBookingsRepository } from "./bookings.ts";
export { getPaymentsRepository } from "./payments.ts";

