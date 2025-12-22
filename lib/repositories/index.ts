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
export * from "./services.ts";
export * from "./staff.ts";
export * from "./orders.ts";
export * from "./refunds.ts";
export * from "./payouts.ts";
export * from "./notifications.ts";
export * from "./otp.ts";
export * from "./settlements.ts";

// Re-export repository instances for convenience
export { getCustomersRepository } from "./customers.ts";
export { getVendorsRepository } from "./vendors.ts";
export { getBookingsRepository } from "./bookings.ts";
export { getPaymentsRepository } from "./payments.ts";
export { getServicesRepository } from "./services.ts";
export { getStaffRepository } from "./staff.ts";
export { getOrdersRepository } from "./orders.ts";
export { getRefundsRepository } from "./refunds.ts";
export { getPayoutsRepository } from "./payouts.ts";
export { getNotificationsRepository } from "./notifications.ts";
export { getOtpRepository } from "./otp.ts";
export { getSettlementsRepository } from "./settlements.ts";
export * from "./commissions.ts";
export { getCommissionsRepository } from "./commissions.ts";
export * from "./reviews.ts";
export { getReviewsRepository } from "./reviews.ts";
export * from "./pets.ts";
export { getPetsRepository } from "./pets.ts";
export * from "./sessions.ts";
export { getSessionsRepository } from "./sessions.ts";
export * from "./wallets.ts";
export { getWalletsRepository } from "./wallets.ts";
export * from "./regions.ts";
export { getRegionsRepository } from "./regions.ts";
export * from "./roles.ts";
export { getRolesRepository } from "./roles.ts";
export * from "./payment-tiers.ts";
export { getPaymentTiersRepository } from "./payment-tiers.ts";

