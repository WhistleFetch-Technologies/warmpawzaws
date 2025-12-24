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
export { getProductsRepository } from "./products.ts";
export { getRefundsRepository } from "./refunds.ts";
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
export * from "./bank-accounts.ts";
export { getBankAccountsRepository } from "./bank-accounts.ts";
export * from "./vendor-tiers.ts";
export { getVendorTiersRepository } from "./vendor-tiers.ts";
export * from "./gps-tracking.ts";
export { getGPSTrackingSessionsRepository } from "./gps-tracking.ts";
export * from "./tele-sessions.ts";
export { getTeleSessionsRepository } from "./tele-sessions.ts";
export * from "./tele-queues.ts";
export { getTeleQueuesRepository } from "./tele-queues.ts";
export * from "./medical-records.ts";
export { getMedicalRecordsRepository } from "./medical-records.ts";
export * from "./prescriptions.ts";
export { getPrescriptionsRepository } from "./prescriptions.ts";
export * from "./packages.ts";
export { getPackagesRepository } from "./packages.ts";
export * from "./holiday-packages.ts";
export { getHolidayPackagesRepository } from "./holiday-packages.ts";
export * from "./insurance.ts";
export { getInsuranceRepository } from "./insurance.ts";
export * from "./adoption.ts";
export { getAdoptionRepository } from "./adoption.ts";
export * from "./boarding-rooms.ts";
export { getBoardingRoomsRepository } from "./boarding-rooms.ts";
export * from "./cafe-tables.ts";
export { getCafeTablesRepository } from "./cafe-tables.ts";
export * from "./resort-precheck.ts";
export { getResortPreCheckRepository } from "./resort-precheck.ts";
export * from "./training-progress.ts";
export { getTrainingProgressRepository } from "./training-progress.ts";
export * from "./gst-configurations.ts";
export { getGstConfigurationsRepository } from "./gst-configurations.ts";
export * from "./promotions.ts";
export { getPromotionsRepository } from "./promotions.ts";
export * from "./coupons.ts";
export { getCouponsRepository } from "./coupons.ts";
export * from "./banners.ts";
export { getBannersRepository } from "./banners.ts";
export * from "./spotlight-offers.ts";
export { getSpotlightOffersRepository } from "./spotlight-offers.ts";
export * from "./loyalty.ts";
export { getLoyaltyRepository } from "./loyalty.ts";
export * from "./ecommerce-categories.ts";
export { getEcommerceCategoriesRepository } from "./ecommerce-categories.ts";
export * from "./invoices.ts";
export { getInvoicesRepository } from "./invoices.ts";
export * from "./advertising.ts";
export { getAdvertisingRepository } from "./advertising.ts";
export * from "./ecommerce-policies.ts";
export { getEcommercePoliciesRepository } from "./ecommerce-policies.ts";
export * from "./returns.ts";
export { getReturnsRepository } from "./returns.ts";
export * from "./ambulance-vehicles.ts";
export { getAmbulanceVehiclesRepository } from "./ambulance-vehicles.ts";
export * from "./diagnostic-tests.ts";
export { getDiagnosticTestsRepository } from "./diagnostic-tests.ts";
export * from "./meal-plans.ts";
export { getMealPlansRepository } from "./meal-plans.ts";
export * from "./boarding-facilities.ts";
export { getBoardingFacilitiesRepository } from "./boarding-facilities.ts";
export * from "./pet-profile-publishing.ts";
export { getPetProfilePublishingRepository } from "./pet-profile-publishing.ts";
export * from "./delivery-integration.ts";
export { getDeliveryIntegrationRepository } from "./delivery-integration.ts";
export * from "./notification-templates.ts";
export { getNotificationTemplatesRepository } from "./notification-templates.ts";
export * from "./performance-monitoring.ts";
export { getPerformanceMonitoringRepository } from "./performance-monitoring.ts";
export * from "./optimization-tasks.ts";
export { getOptimizationTasksRepository } from "./optimization-tasks.ts";

