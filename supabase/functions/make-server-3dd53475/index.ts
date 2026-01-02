// supabase/functions/make-server-3dd53475/index.ts

// Centralized CORS configuration
const DEFAULT_ALLOW_ORIGIN = "*"; // tighten in production
const ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";
const ALLOW_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? DEFAULT_ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Max-Age": "86400",
  } as Record<string, string>;
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders(origin),
    },
  });
}

// Import Hono and endpoint modules
import { Hono } from 'npm:hono@4';
import { regionEndpoints } from './region-endpoints-refactored.tsx'; // ✅ SQL-only: Region endpoints (Batch 12, 1 KV op removed)
import { onboardingFormAPI } from './onboarding-form-api.tsx';
import { onboardingConfigEndpoints } from './onboarding-config-endpoints-refactored.tsx'; // ✅ SQL-only: Onboarding config endpoints (Batch 12, 1 KV op removed)
import { registerAdminVendorRoutes } from './admin-vendor-routes-sql.tsx';
import { roleConfigEndpoints } from './role-config-endpoints.tsx';
import { catalogEndpointsSQL } from './catalog-endpoints-sql.tsx';
import { staffScheduleEndpointsSQL } from './staff-schedule-endpoints-sql.tsx';
import { reschedulingPoliciesEndpointsSQL } from './rescheduling-policies-sql.tsx';
import { searchEndpointsSQL } from './search-endpoints-sql.tsx';
import { agoraVideoEndpointsSQL } from './agora-video-integration-sql.tsx';
import { eventManagementEndpointsSQL } from './event-management-endpoints-sql.tsx'; // ✅ SQL-only: Event management (18 KV ops removed)
import { donationManagementEndpointsSQL } from './donation-management-endpoints-sql.tsx'; // ✅ SQL-only: Donation management endpoints (Batch 22, 19 KV ops removed)
// ✅ NEW: Batch 13 SQL-only endpoints
import { staffDiscoveryEndpoints } from './staff-discovery-endpoints-sql.tsx'; // ✅ SQL-only: Staff discovery (13 KV ops removed)
import { standardizedOtpEndpointsSQL } from './standardized-otp-endpoints-sql.tsx'; // ✅ SQL-only: Standardized OTP (11 KV ops removed)
import { appointmentLifecycleEndpointsSQL } from './appointment-lifecycle-endpoints-sql.tsx'; // ✅ SQL-only: Appointment lifecycle (13 KV ops removed)
import { transactionMonitoringEndpoints } from './transaction-monitoring-endpoints-sql.tsx'; // ✅ SQL-only: Transaction monitoring (Batch 7 Phase 4)
import { registerProfilePhotoEndpoints } from './profile-photo-management-sql.tsx'; // ✅ SQL-only: Profile photo management (11 KV ops removed)
import { cctvAccessEndpointsSQL } from './cctv-access-endpoints-sql.tsx'; // ✅ SQL-only: CCTV access (11 KV ops removed)
import { homeServiceAutoAssignmentSQL } from './home-service-auto-assignment-sql.tsx'; // ✅ SQL-only: Home service auto-assignment (11 KV ops removed)
import { registerPetSuggestionSystem } from './pet-suggestion-system-sql.tsx'; // ✅ SQL-only: Pet suggestion system (12 KV ops removed)
import { advancedFilteringSystemSQL } from './advanced-filtering-system-sql.tsx'; // ✅ SQL-only: Advanced filtering (15 KV ops removed)
import { staffSpecializationEndpoints } from './staff-specialization-system-sql.tsx'; // ✅ SQL-only: Staff specialization system (7 KV ops removed - Batch 10 Phase 1)
import universalStaffProblemSearchSQL from './universal-staff-problem-search-sql.tsx'; // ✅ SQL-only: Universal staff problem search (7 KV ops removed - Batch 10 Phase 1)
import { tierUpgradeAutomationSQL } from './tier-upgrade-automation-sql.tsx'; // ✅ SQL-only: Tier upgrade automation (14 KV ops removed)
// ✅ NEW: Batch 14 SQL-only endpoints
import { systemHealthCheckSQL } from './system-health-check-sql.tsx'; // ✅ SQL-only: System health check (14 KV ops removed)
import { enhancedGpsTrackingSQL } from './enhanced-gps-tracking-sql.tsx'; // ✅ SQL-only: Enhanced GPS tracking (14 KV ops removed)
import { nutritionistFoodDeliveryEndpointsSQL } from './nutritionist-food-delivery-sql.tsx'; // ✅ SQL-only: Nutritionist food delivery (15 KV ops removed)
import { customerWalletTopupSQL } from './customer-wallet-topup-sql.tsx'; // ✅ SQL-only: Customer wallet top-up
import { universalStaffSearchSQL } from './universal-staff-search-sql.tsx'; // ✅ SQL-only: Universal staff search (Batch 8, 13 KV ops removed)
import { previousProvidersEndpointsSQL } from './previous-providers-sql.tsx'; // ✅ SQL-only: Previous providers (Batch 8, 12 KV ops removed)
import { nutritionistDietPlanEndpointsSQL } from './nutritionist-diet-plan-endpoints-sql.tsx'; // ✅ SQL-only: Nutritionist diet plans (Batch 8, 12 KV ops removed)
import { registerMedicalHistoryEndpointsSQL } from './medical-history-endpoints-sql.tsx'; // ✅ SQL-only: Medical history (Batch 8, 12 KV ops removed)
import { logisticsPartnerIntegrationEndpointsSQL } from './logistics-partner-integration-sql.tsx'; // ✅ SQL-only: Logistics partner integration (Batch 9, 28 KV ops removed)
import { foodDeliveryHyperlocalEndpointsSQL } from './food-delivery-hyperlocal-sql.tsx'; // ✅ SQL-only: Food delivery hyperlocal (Batch 9, 26 KV ops removed)
import additionalCapabilitiesEndpointsSQL from './additional-capabilities-endpoints-sql.tsx'; // ✅ SQL-only: Additional capabilities (Batch 9, 30 KV ops removed)
import { reportBuilderEndpoints } from './report-builder-endpoints-sql.tsx'; // ✅ SQL-only: Report builder (Batch 9, 20 KV ops removed)
import { registerAnalyticsDashboardSprint2SQL } from './analytics-dashboard-sprint2-sql.tsx'; // ✅ SQL-only: Analytics dashboard sprint 2 (Batch 9, 26 KV ops removed)
import { tierUpgradeEndpoints } from './tier-upgrade-endpoints-sql.tsx'; // ✅ SQL-only: Tier upgrade endpoints (Batch 9, 17 KV ops removed)
import { registerVideoCallEndpoints } from './video-call-endpoints-sql.tsx'; // ✅ SQL-only: Video call endpoints (Batch 9, 18 KV ops removed)
import { registerAWSChimeVideoEndpointsSQL } from './aws-chime-video-integration-sql.tsx'; // ✅ SQL-only: AWS Chime video (Batch 9, 12 KV ops removed)
import { registerAWSChimeChatEndpoints } from './aws-chime-chat-integration-sql.tsx'; // ✅ SQL-only: AWS Chime chat (Batch 9, 12 KV ops removed)
import dynamicOnboardingFieldsSQL from './dynamic-onboarding-fields-sql.tsx'; // ✅ SQL-only: Dynamic onboarding fields (Batch 9, 8 KV ops removed)
import { registerBookingLifecycleEndpoints } from './booking-lifecycle-sql.tsx'; // ✅ SQL-only: Booking lifecycle (Batch 9, 9 KV ops removed)
import serviceComparisonSystemSQL from './service-comparison-system-sql.tsx'; // ✅ SQL-only: Service comparison system (Batch 9, 9 KV ops removed)
import { registerVendorProfileUpdateEndpoints } from './vendor-profile-update-sql.tsx'; // ✅ SQL-only: Vendor profile update (Batch 9, 5 KV ops removed)
// ✅ NEW: Batch 10 SQL-only endpoints
import { initializeRoleService } from './role-service-sql.tsx'; // ✅ SQL-only: Role service (Batch 10, 7 KV ops removed)
// ✅ FIX: Removed duplicate import - staffSpecializationEndpoints already imported on line 51
// import { staffSpecializationEndpointsSQL } from './staff-specialization-system-sql.tsx'; // ✅ SQL-only: Staff specialization system (Batch 10, 7 KV ops removed)
// ✅ FIX: universalStaffProblemSearchSQL already imported on line 52 as default import
// import { universalStaffProblemSearchEndpointsSQL } from './universal-staff-problem-search-sql.tsx'; // ✅ SQL-only: Universal staff problem search (Batch 10, 7 KV ops removed)
import homeServicesEnhancedSQL from './home-services-enhanced-sql.tsx'; // ✅ SQL-only: Home services enhanced (Batch 10, 5 KV ops removed)
import { unifiedServiceDiscoveryEndpoints } from './unified-service-discovery-sql.tsx'; // ✅ SQL-only: Unified service discovery (Batch 10 Phase 2, 4 KV ops removed)
import vendorBankValidationSQL from './vendor-bank-validation-sql.tsx'; // ✅ SQL-only: Vendor bank validation (Batch 10 Phase 2, 4 KV ops removed)
import { registerLogisticsEndpoints } from './logistics-adapter-sql.tsx'; // ✅ SQL-only: Logistics adapter (Batch 10 Phase 2, 4 KV ops removed)
// ✅ NEW: Batch 10 Phase 3 SQL-only endpoints
import { registerAnalyticsIngestion } from './analytics-events-sql.tsx'; // ✅ SQL-only: Analytics events (Batch 10 Phase 3, 4 KV ops removed)
import scheduleSettingsEndpointsSQL from './schedule-settings-endpoints-sql.tsx'; // ✅ SQL-only: Schedule settings (Batch 10 Phase 3, 3 KV ops removed)
import { radarLocationSystemEndpoints } from './radar-location-system-sql.tsx'; // ✅ SQL-only: Radar location system (Batch 10 Phase 3, 3 KV ops removed)
import { registerVendorCatalogAPI } from './vendor-catalog-api-sql.tsx'; // ✅ SQL-only: Vendor catalog API (Batch 10 Phase 3, 3 KV ops removed)
import { registerLogisticsRoutingEndpointsSQL } from './logistics-routing-engine-sql.tsx'; // ✅ SQL-only: Logistics routing engine (Batch 10 Phase 3, 6 KV ops removed)
import enhancedProblemDiscoverySQL from './enhanced-problem-discovery-sql.tsx'; // ✅ SQL-only: Enhanced problem discovery (Batch 10 Phase 3, 4 KV ops removed)
// ✅ NEW: Batch 11 SQL-only endpoints
import { registerVendorMetricsEnhancementSQL } from './vendor-metrics-enhancement-sql.tsx'; // ✅ SQL-only: Vendor metrics enhancement (Batch 11, 29 KV ops removed)
import { performanceOptimizationEndpointsSQL } from './performance-optimization-endpoints-sql.tsx'; // ✅ SQL-only: Performance optimization (Batch 11, 26 KV ops removed)
import { registerServicePackageManagement } from './service-package-management-sql.tsx'; // ✅ SQL-only: Service package management (Batch 11, 20 KV ops removed)
import { registerInsuranceClaimEndpoints } from './insurance-claim-management-sql.tsx'; // ✅ SQL-only: Insurance claim management (Batch 11, 20 KV ops removed)
import { settlementTierSystemEndpoints } from './settlement-tier-system-enhanced-sql.tsx'; // ✅ SQL-only: Settlement tier system enhanced (Batch 11, 7 KV ops removed)
// ✅ NEW: Batch 15 SQL-only endpoints (additional ones)
import { independentVendorSystemEndpointsSQL } from './independent-vendor-system-sql.tsx'; // ✅ SQL-only: Independent vendor system (Batch 15, 12 KV ops removed)
import { registerDatingChatEndpointsSQL } from './dating-chat-endpoints-sql.tsx'; // ✅ SQL-only: Dating chat (Batch 15, 12 KV ops removed)
import scheduledTeleBookingSQL from './scheduled-tele-booking-sql.tsx'; // ✅ SQL-only: Scheduled tele booking (9 KV ops removed)
import { integratedServicesManagerEndpointsSQL } from './integrated-services-manager-sql.tsx'; // ✅ SQL-only: Integrated services manager (9 KV ops removed)
import { razorpayMarketplaceSettlementSQL } from './razorpay-marketplace-settlement-sql.tsx'; // ✅ SQL-only: Razorpay marketplace settlement (Batch 9, 6 KV ops removed)
import { tierCommissionIntegrationEndpointsSQL } from './tier-commission-integration-sql.tsx'; // ✅ SQL-only: Tier commission (Batch 15, 11 KV ops removed)
import { staffServiceStyleSetupEndpointsSQL } from './staff-service-style-setup-sql.tsx'; // ✅ SQL-only: Staff service style setup (Batch 15, 11 KV ops removed)
import memorialEndpointsSQL from './memorial-endpoints-sql.tsx'; // ✅ SQL-only: Memorial endpoints (Batch 15, 11 KV ops removed)
// ✅ NEW: Batch 16 SQL-only endpoints
import integratedServicesCompleteSQL from './integrated-services-complete-sql.tsx'; // ✅ SQL-only: Integrated services (11 KV ops removed)
import { updateProviderLocationIndex, findProvidersNearby } from './geospatial-index-sql.tsx'; // ✅ SQL-only: Geospatial indexing (11 KV ops removed)
import { assignInstantTele, assignHomeService } from './auto-assignment-logic-sql.tsx'; // ✅ SQL-only: Auto-assignment logic (11 KV ops removed)
import advancedSearchEngineSQL from './advanced-search-engine-sql.tsx'; // ✅ SQL-only: Advanced search engine (11 KV ops removed)
import vendorAnalyticsEndpointsSQL from './vendor-analytics-endpoints-sql.tsx'; // ✅ SQL-only: Vendor analytics (10 KV ops removed)
import { isSoloProvider, getSoloProviderSession, resolveVendorLogin } from './solo-provider-auth-sql.tsx'; // ✅ SQL-only: Solo provider auth (10 KV ops removed)
import searchAnalyticsAPISQL from './search-analytics-api-sql.tsx'; // ✅ SQL-only: Search analytics (10 KV ops removed)
import healthProblemEndpointsSQL from './health-problem-endpoints-sql.tsx'; // ✅ SQL-only: Health problem endpoints (10 KV ops removed)
import elasticsearchProxySQL from './elasticsearch-proxy-sql.tsx'; // ✅ SQL-only: Elasticsearch proxy (10 KV ops removed)
import automatedBankVerificationSQL from './automated-bank-verification-sql.tsx'; // ✅ SQL-only: Automated bank verification (10 KV ops removed)
// ✅ NEW: Batch 17 SQL-only endpoints
import bookingValidationEndpointsSQL from './booking-validation-endpoints-sql.tsx'; // ✅ SQL-only: Booking validation (Batch 17, 8 KV ops removed)
import { cancellationPolicyEndpoints } from './cancellation-policy-endpoints-sql.tsx'; // ✅ SQL-only: Cancellation policy (Batch 17, 8 KV ops removed)
import slotAvailabilityEndpointsSQL from './slot-availability-endpoints-sql.tsx'; // ✅ SQL-only: Slot availability (Batch 17, 8 KV ops removed)
import { nutritionistFoodIntegrationEndpoints } from './nutritionist-food-integration-sql.tsx'; // ✅ SQL-only: Nutritionist food integration (Batch 17, 7 KV ops removed)
import { refundPolicyEndpoints } from './refund-policy-engine-enhanced-sql.tsx'; // ✅ SQL-only: Refund policy engine (Batch 17, 7 KV ops removed)
import { marketplacePaymentEndpoints } from './marketplace-payment-endpoints-refactored.tsx'; // ✅ SQL-only: Marketplace payment endpoints (Batch 12, 1 KV op removed)
// ✅ NEW: Batch 1 Phase 3 - Additional Financial Operations (Phase 3 Registration)
import { registerRazorpayRefundProcessor } from './razorpay-refund-processor.tsx'; // ✅ SQL-only: Razorpay refund processor (Batch 1, KV ops removed)
import { razorpayPaymentEndpoints } from './razorpay-payment-endpoints-sql.tsx'; // ✅ SQL-only: Razorpay payment endpoints (Batch 1, KV ops removed) - FIXED: Updated to SQL version
import { registerSettlementAutomation } from './settlement-automation.tsx'; // ✅ SQL-only: Settlement automation (Batch 1, KV ops removed)
import { registerPayoutCronJob } from './payout-cron-job.tsx'; // ✅ SQL-only: Payout cron job (Batch 1, KV ops removed)
import { adminPayoutEndpoints } from './admin-payout-endpoints.tsx'; // ✅ SQL-only: Admin payout endpoints (Batch 1, KV ops removed)
import automatedPayoutProcessingSQL from './automated-payout-processing-sql.tsx'; // ✅ SQL-only: Automated payout processing (Batch 1, KV ops removed)
import { marketplaceSettlementEnhanced } from './marketplace-settlement-enhanced-sql.tsx'; // ✅ SQL-only: Marketplace settlement enhanced (Batch 1, KV ops removed)
import { marketplaceSettlementAutomationEndpointsSQL } from './marketplace-settlement-automation-sql.tsx'; // ✅ SQL-only: Marketplace settlement automation (Batch 1, KV ops removed)
import { automatedPayoutEndpointsSQL } from './automated-vendor-payouts-sql.tsx'; // ✅ SQL-only: Automated vendor payouts (Batch 1, KV ops removed)
// ✅ NEW: Batch 18 SQL-only endpoints
import appointmentDetailEndpointsSQL from './appointment-detail-endpoints-sql.tsx'; // ✅ SQL-only: Appointment detail endpoints (Batch 18, 5 KV ops removed)
import { registerAppointmentReminderSystemSQL } from './appointment-reminder-system-sql.tsx'; // ✅ SQL-only: Appointment reminder system (Batch 18, 24 KV ops removed)
import { consultationNotesEndpointsSQL } from './consultation-notes-endpoints-sql.tsx'; // ✅ SQL-only: Consultation notes endpoints (Batch 18, 6 KV ops removed)
import { pharmacyPrescriptionEndpointsSQL } from './pharmacy-prescription-endpoints-sql.tsx'; // ✅ SQL-only: Pharmacy prescription endpoints (Batch 18, 37 KV ops removed)
import { registerCustomerMedicalRecordsEndpointsSQL } from './customer-medical-records-sql.tsx'; // ✅ SQL-only: Customer medical records (Batch 18, 16 KV ops removed)
import { bankVerificationEndpoints } from './bank-verification-endpoints-sql.tsx'; // ✅ SQL-only: Bank verification endpoints (Batch 18, 17 KV ops removed)
import { registerExpiryManagementEndpointsSQL } from './expiry-management-endpoints-sql.tsx'; // ✅ SQL-only: Expiry management endpoints (Batch 18, 8 KV ops removed)
import cafeTableManagementSQL from './cafe-table-management-sql.tsx'; // ✅ SQL-only: Cafe table management (Batch 18, 23 KV ops removed)
// ✅ NEW: Batch 10 Additional SQL-only endpoints
import settlementScheduleEndpointsSQL from './settlement-schedule-endpoints-sql.tsx'; // ✅ SQL-only: Settlement schedule endpoints (Batch 10, 20 KV ops removed)
import rewardsLoyaltySystemSQL from './rewards-loyalty-system-sql.tsx'; // ✅ SQL-only: Rewards & loyalty system (Batch 10, 13 KV ops removed)
import trainerProgressTrackingSQL from './trainer-progress-tracking-sql.tsx'; // ✅ SQL-only: Trainer progress tracking (Batch 10, 22 KV ops removed)
import vetSummaryEndpointsSQL from './vet-summary-endpoints-sql.tsx'; // ✅ SQL-only: Vet summary endpoints (Batch 10, 10 KV ops removed)
import { diagnosticsCenterEndpoints } from './diagnostics-center-endpoints-sql.tsx'; // ✅ SQL-only: Diagnostics center endpoints (Batch 10, 1 KV op removed)
import { specializedServicesEndpoints } from './specialized-services-endpoints-sql.tsx'; // ✅ SQL-only: Specialized services endpoints (Batch 10, 1 KV op removed)
import { registerSubscriptionEndpoints } from './subscription-endpoints-sql.tsx'; // ✅ SQL-only: Subscription endpoints (Batch 10, 13 KV ops removed)
import { registerSmsOtpService } from './sms-otp-service-sql.tsx'; // ✅ SQL-only: SMS OTP service (Batch 10, 13 KV ops removed)
import customerEcommerceEndpointsSQL from './customer-ecommerce-endpoints-sql.tsx'; // ✅ SQL-only: Customer e-commerce endpoints (31 KV ops removed)
// ✅ NEW: Batch 19 SQL-only endpoints
import patientMonitoringEndpointsSQL from './patient-monitoring-endpoints-sql.tsx'; // ✅ SQL-only: Patient monitoring endpoints (Batch 19, 7 KV ops removed)
import { registerCriticalFlowFixesSQL } from './critical-flow-fixes-sql.tsx'; // ✅ SQL-only: Critical flow fixes (Batch 19, 17 KV ops removed)
import enhancedServicePublishingSQL from './enhanced-service-publishing-sql.tsx'; // ✅ SQL-only: Enhanced service publishing (Batch 19, 8 KV ops removed)
import { multiServiceSchedulingEndpoints } from './multi-service-scheduling-sql.tsx'; // ✅ SQL-only: Multi-service scheduling (Batch 19, 5 KV ops removed)
import { registerQaGapFixesSQL } from './qa-gap-fixes-sql.tsx'; // ✅ SQL-only: QA gap fixes (Batch 19, 32 KV ops removed)
import referralSystemSQL from './referral-system-sql.tsx'; // ✅ SQL-only: Referral system (Batch 19, 24 KV ops removed)
import { petEndpoints } from './pet-endpoints-sql.tsx'; // ✅ SQL-only: Pet endpoints (Batch 19, 21 KV ops removed)
import medicineReorderEndpointsSQL from './medicine-reorder-endpoints-sql.tsx'; // ✅ SQL-only: Medicine reorder endpoints (Batch 19, 21 KV ops removed)
import { registerCustomerPackageEndpoints } from './customer-package-endpoints-sql.tsx'; // ✅ SQL-only: Customer package endpoints (SQL version exists, no KV ops in original)
import { registerCustomerAppEnhancementsSQL } from './customer-app-enhancements-sql.tsx'; // ✅ SQL-only: Customer app enhancements (48 KV ops removed)
import { homeServicesEndpointsSQL } from './home-services-endpoints-sql.tsx'; // ✅ SQL-only: Home services endpoints (37 KV ops removed)
import { ambulanceServiceEndpoints } from './ambulance-service-endpoints-sql.tsx'; // ✅ SQL-only: Ambulance service endpoints (KV ops removed)
// ✅ NEW: Batch 20 SQL-only endpoints
import { bookingManagementEndpointsSQL } from './booking-management-endpoints-sql.tsx'; // ✅ SQL-only: Booking management endpoints (Batch 20, 38 KV ops removed)
import { bookingEndpointsSQL } from './booking-endpoints-sql.tsx'; // ✅ SQL-only: Booking endpoints (Batch 20, ~15 KV ops removed)
import { vendorBookingActionsEndpointsSQL } from './vendor-booking-actions-sql.tsx'; // ✅ SQL-only: Vendor booking actions (Batch 20, 7 KV ops removed)
import vendorBookingsSQL from './vendor-bookings-sql.tsx'; // ✅ SQL-only: Vendor bookings (Batch 20, 10 KV ops removed)
// ✅ NEW: Batch 21 SQL-only endpoints
import adoptionEndpointsSQL from './adoption-endpoints-sql.tsx'; // ✅ SQL-only: Adoption endpoints (Batch 21, ~14 KV ops removed)
import { analyticsAggregationEndpoints } from './analytics-aggregation-sql.tsx'; // ✅ SQL-only: Analytics aggregation (Batch 21, 20 KV ops removed)
import { adminIntegrationEndpoints } from './admin-integration-endpoints-sql.tsx'; // ✅ SQL-only: Admin integration endpoints (Batch 21, ~25 KV ops removed)
import { analyticsDashboardEndpoints } from './analytics-dashboard-endpoints-sql.tsx'; // ✅ SQL-only: Analytics dashboard endpoints (Batch 21, ~11 KV ops removed)
// ✅ NEW: Batch 22 SQL-only endpoints
import { registerCafeFeatures } from './cafe-features-sql.tsx'; // ✅ SQL-only: Cafe features (Batch 22, ~21 KV ops removed)
import { registerBoardingRoomManagement } from './boarding-room-management-sql.tsx'; // ✅ SQL-only: Boarding room management (Batch 22, ~13 KV ops removed)
import { notificationTemplateSystem } from './notification-template-system-sql.tsx'; // ✅ SQL-only: Notification template system (Batch 22, ~12 KV ops removed)
import { registerAdminServiceCatalogSQL } from './admin-service-catalog-sql.tsx'; // ✅ SQL-only: Admin service catalog (Batch 22, ~20 KV ops removed)
import { adminEcommerceDashboardEndpointsSQL } from './admin-ecommerce-dashboard-sql.tsx'; // ✅ SQL-only: Admin e-commerce dashboard (Batch 22, ~15 KV ops removed)
// ✅ NEW: Batch 23 SQL-only endpoints
import { advertisingEndpointsSQL } from './advertising-endpoints-sql.tsx'; // ✅ SQL-only: Advertising endpoints (Batch 23, KV ops removed)
import { advancedSearchAPISQL } from './advanced-search-api-sql.tsx'; // ✅ SQL-only: Advanced search API (Batch 23, KV ops removed)
import { registerBannerEndpointsSQL } from './banner-endpoints-sql.tsx'; // ✅ SQL-only: Banner endpoints (Batch 23, KV ops removed)
import { registerContentManagementEndpointsSQL } from './content-management-endpoints-sql.tsx'; // ✅ SQL-only: Content management endpoints (Batch 23, KV ops removed)
import { registerCouponEndpointsSQL } from './coupon-endpoints-sql.tsx'; // ✅ SQL-only: Coupon endpoints (Batch 23, KV ops removed)
// ✅ NEW: Batch 24 SQL-only endpoints
import { registerClinicDoctorEndpointsSQL } from './clinic-doctor-endpoints-sql.tsx'; // ✅ SQL-only: Clinic doctor endpoints (Batch 24, ~45 KV ops removed)
import controlledSubstancesEndpointsSQL from './controlled-substances-endpoints-sql.tsx'; // ✅ SQL-only: Controlled substances endpoints (Batch 24, ~14 KV ops removed)
import { backwardsCompatibleEndpoints } from './backwards-compatible-endpoints-sql.tsx'; // ✅ SQL-only: Backwards compatible endpoints (Batch 24, KV ops removed)
import { registerBookingLifecycleManagement } from './booking-lifecycle-management-sql.tsx'; // ✅ SQL-only: Booking lifecycle management (Batch 24, ~30 KV ops removed)
import { centerAvailabilityEndpointsSQL } from './center-availability-endpoints-sql.tsx'; // ✅ SQL-only: Center availability endpoints (Batch 24, KV ops removed)
// ✅ NEW: Batch 25 SQL-only endpoints
import { customerPetsRoutes } from './customer-pets-sql.tsx'; // ✅ SQL-only: Customer pets routes (Batch 25, ~2 KV ops removed)
import { registerCustomerSearchEndpoints } from './customer-search-endpoints-sql.tsx'; // ✅ SQL-only: Customer search endpoints (Batch 25, ~12 KV ops removed)
import { registerDatingChatSQL } from './dating-chat-sql.tsx'; // ✅ SQL-only: Dating chat endpoints (Batch 25, ~20 KV ops removed)
import { registerDelhiveryIntegrationSQL } from './delhivery-integration-sql.tsx'; // ✅ SQL-only: Delhivery integration (Batch 25, ~18 KV ops removed)
import { deliveryIntegrationEndpoints } from './delivery-integration-endpoints-sql.tsx'; // ✅ SQL-only: Delivery integration endpoints (Batch 25, ~15 KV ops removed)
// ✅ NEW: Batch 26 SQL-only endpoints
import doctorDiscoveryEndpointsSQL from './doctor-discovery-endpoints-sql.tsx'; // ✅ SQL-only: Doctor discovery endpoints (Batch 26, KV ops removed)
import { ecommercePoliciesEndpointsSQL } from './ecommerce-policies-endpoints-sql.tsx'; // ✅ SQL-only: E-commerce policies endpoints (Batch 26, KV ops removed)
import { ecommerceRoutesSQL } from './ecommerce-routes-sql.tsx'; // ✅ SQL-only: E-commerce routes (Batch 26, KV ops removed)
import elasticsearchCompleteSQL from './elasticsearch-complete-sql.tsx'; // ✅ SQL-only: Elasticsearch complete (Batch 26, KV ops removed)
import enhancedRefundSystemSQL from './enhanced-refund-system-sql.tsx'; // ✅ SQL-only: Enhanced refund system (Batch 26, KV ops removed)
import { vendorManagementEndpointsSQL } from './vendor-management-sql.tsx'; // ✅ SQL-only: Vendor management (Batch 26, 12 KV ops removed)
// ✅ NEW: Batch 27 SQL-only endpoints
import facilityEndpointsSQL from './facility-endpoints-sql.tsx'; // ✅ SQL-only: Facility endpoints (Batch 27, ~12 KV ops removed)
import { followupEndpointsSQL } from './followup-endpoints-sql.tsx'; // ✅ SQL-only: Followup endpoints (Batch 27, ~37 KV ops removed)
import { registerGroomerGalleryEndpoints } from './groomer-gallery-system-sql.tsx'; // ✅ SQL-only: Groomer gallery system (Batch 27, KV ops removed)
import { comprehensiveGapFixesSQL } from './gap-fixes-comprehensive-sql.tsx'; // ✅ SQL-only: Gap fixes comprehensive (Batch 27, KV ops removed)
// ✅ NEW: Batch 28 SQL-only endpoints
import { gstConfigurationEndpointsSQL } from './gst-configuration-endpoints-sql.tsx'; // ✅ SQL-only: GST configuration endpoints (Batch 28, KV ops removed)
import { holidayPackageEndpoints } from './holiday-package-endpoints-sql.tsx'; // ✅ SQL-only: Holiday package endpoints (Batch 28, KV ops removed)
import { holidayPackageSystemEndpoints } from './holiday-package-system-sql.tsx'; // ✅ SQL-only: Holiday package system (Batch 28, KV ops removed)
import { homeSampleCollectionEndpointsSQL } from './home-sample-collection-endpoints-sql.tsx'; // ✅ SQL-only: Home sample collection endpoints (Batch 28, KV ops removed)
import instantTeleBookingSQL from './instant-tele-booking-sql.tsx'; // ✅ SQL-only: Instant tele booking (Batch 28, KV ops removed)
import { instantTeleEndpoints } from './instant-tele-endpoints-sql.tsx'; // ✅ SQL-only: Instant tele endpoints (Batch 28, KV ops removed)
import { insuranceEndpoints } from './insurance-endpoints-sql.tsx'; // ✅ SQL-only: Insurance endpoints (Batch 28, KV ops removed)
import { invoiceEndpointsSQL } from './invoice-endpoints-sql.tsx'; // ✅ SQL-only: Invoice endpoints (Batch 28, KV ops removed)
// ✅ NEW: Batch 29 SQL-only endpoints
import { registerLoyaltyEndpointsSQL } from './loyalty-endpoints-sql.tsx'; // ✅ SQL-only: Loyalty endpoints (Batch 29, KV ops removed)
import marketingRoutesV2SQL from './marketing-routes-v2-sql.tsx'; // ✅ SQL-only: Marketing routes v2 (Batch 29, KV ops removed)
import { registerHomeServiceBookingFlow } from './home-service-booking-flow-sql.tsx'; // ✅ SQL-only: Home service booking flow (Batch 29, KV ops removed)
// ✅ NEW: Batch 30 SQL-only endpoints
import { elasticsearchIntegration } from './elasticsearch-integration-sql.tsx'; // ✅ SQL-only: Elasticsearch integration (Batch 30, KV ops removed)
import enhancedStaffAvailabilityWithConflictsSQL from './enhanced-staff-availability-with-conflicts-sql.tsx'; // ✅ SQL-only: Enhanced staff availability with conflicts (Batch 30, KV ops removed)
import { logisticsOrderIntegrationEndpointsSQL } from './logistics-order-integration-sql.tsx'; // ✅ SQL-only: Logistics order integration (Batch 30, KV ops removed)
// ✅ NEW: Batch 31 SQL-only endpoints
import { registerMarketplaceProducts } from './marketplace-products-sql.tsx'; // ✅ SQL-only: Marketplace products (Batch 31, KV ops removed)
import { registerMedicalAISummaryEndpoints } from './medical-ai-summary-endpoints-sql.tsx'; // ✅ SQL-only: Medical AI summary endpoints (Batch 31, KV ops removed)
import { registerNutritionistMealManagementSQL } from './nutritionist-meal-management-sql.tsx'; // ✅ SQL-only: Nutritionist meal management (Batch 31, KV ops removed)
import { nutritionistSystemEndpointsSQL } from './nutritionist-system-sql.tsx'; // ✅ SQL-only: Nutritionist system endpoints (Batch 31, KV ops removed)
import { orderLifecycleCompleteEndpointsSQL } from './order-lifecycle-complete-sql.tsx'; // ✅ SQL-only: Order lifecycle complete (Batch 31, KV ops removed)
import orderManagementEndpointsSQL from './order-management-endpoints-sql.tsx'; // ✅ SQL-only: Order management endpoints (Batch 31, KV ops removed)
import { paymentEndpointsSQL } from './payment-endpoints-sql.tsx'; // ✅ SQL-only: Payment endpoints (Batch 31, KV ops removed)
import { paymentRazorpayEndpointsSQL } from './payment-razorpay-endpoints-sql.tsx'; // ✅ SQL-only: Payment Razorpay endpoints (Batch 31, KV ops removed)
// ✅ NEW: Batch 32 SQL-only endpoints
import { paymentSettlementIntegrationEndpointsSQL } from './payment-settlement-integration-sql.tsx'; // ✅ SQL-only: Payment settlement integration (Batch 32, KV ops removed)
import { performanceMonitoringEndpoints } from './performance-monitoring-endpoints-sql.tsx'; // ✅ SQL-only: Performance monitoring endpoints (Batch 32, KV ops removed)
import { petIntelligenceEndpoints } from './pet-intelligence-endpoints-sql.tsx'; // ✅ SQL-only: Pet intelligence endpoints (Batch 32, KV ops removed)
import { petProfilePublishingEndpoints } from './pet-profile-publishing-endpoints-sql.tsx'; // ✅ SQL-only: Pet profile publishing endpoints (Batch 32, KV ops removed)
import { portfolioEndpointsSQL } from './portfolio-endpoints-sql.tsx'; // ✅ SQL-only: Portfolio endpoints (Batch 32, KV ops removed)
import { registerProblemGridSpecializationSystem } from './problem-grid-specialization-system-sql.tsx'; // ✅ SQL-only: Problem grid specialization system (Batch 32, KV ops removed)
// ✅ NEW: Batch 33 SQL-only endpoints
import { systemOptimizationEndpoints } from './system-optimization-endpoints-sql.tsx'; // ✅ SQL-only: System optimization endpoints (Batch 33, KV ops removed)
import { trainingProgressEndpoints } from './training-progress-endpoints-sql.tsx'; // ✅ SQL-only: Training progress endpoints (Batch 33, KV ops removed)
// ✅ NEW: Batch 34 SQL-only endpoints
import { profitMarginEndpointsSQL } from './profit-margin-endpoints-sql.tsx'; // ✅ SQL-only: Profit margin endpoints (Batch 34, KV ops removed)
import { promotionEndpointsSQL } from './promotion-endpoints-sql.tsx'; // ✅ SQL-only: Promotion endpoints (Batch 34, KV ops removed)
import { registerResortInventory } from './resort-inventory-sql.tsx'; // ✅ SQL-only: Resort inventory endpoints (Batch 34, KV ops removed)
import { resortPreCheckEndpoints } from './resort-precheck-endpoints-sql.tsx'; // ✅ SQL-only: Resort precheck endpoints (Batch 34, KV ops removed)
import { registerReturnsManagementEndpoints } from './returns-management-sql.tsx'; // ✅ SQL-only: Returns management endpoints (Batch 34, KV ops removed)
// ✅ NEW: Batch 11 SQL-only endpoints (refactored files)
import { vendorOnboardingEndpoints } from './vendor-onboarding-refactored.tsx'; // ✅ SQL-only: Vendor onboarding (Batch 11, 1 KV op removed)
import { vendorDashboardEndpoints } from './vendor-dashboard-endpoints-refactored.tsx'; // ✅ SQL-only: Vendor dashboard (Batch 11, 1 KV op removed)
import staffCrudEndpointsSQL from './staff-crud-endpoints-refactored.tsx'; // ✅ SQL-only: Staff CRUD (Batch 11, 1 KV op removed)
import { soloProviderEndpoints } from './solo-provider-endpoints-refactored.tsx'; // ✅ SQL-only: Solo provider (Batch 11, 1 KV op removed)
import { reviewEndpoints } from './review-endpoints-refactored.tsx'; // ✅ SQL-only: Review endpoints (Batch 11, 1 KV op removed)
import { customServiceEndpoints } from './custom-service-endpoints-refactored.tsx'; // ✅ SQL-only: Custom service (Batch 11, 1 KV op removed)
import walletEndpointsSQL from './wallet-endpoints-refactored.tsx'; // ✅ SQL-only: Wallet endpoints (Batch 11, 1 KV op removed)
import { registerVendorSettingsRulesEndpoints } from './vendor-settings-rules-endpoints-refactored.tsx'; // ✅ SQL-only: Vendor settings rules (Batch 11, 1 KV op removed)
import { registerVendorServiceManagementRoutes } from './vendor-service-management-refactored.tsx'; // ✅ SQL-only: Vendor service management (Batch 11, 1 KV op removed)
import { bookingLifecycleCompleteEndpoints } from './booking-lifecycle-complete-refactored.tsx'; // ✅ SQL-only: Booking lifecycle complete (Batch 11, 1 KV op removed)
// ✅ NEW: Batch 12 SQL-only endpoints (refactored files)
import { notificationEndpoints } from './notification-system-refactored.tsx'; // ✅ SQL-only: Notification system (Batch 12, 1 KV op removed)
import { paymentEndpoints } from './payment-endpoints-refactored.tsx'; // ✅ SQL-only: Payment endpoints (Batch 12, 1 KV op removed)
import { registerCustomerRoutes } from './customer-routes-refactored.tsx'; // ✅ SQL-only: Customer routes (Batch 12, 1 KV op removed)
import { analyticsEndpoints } from './analytics-endpoints-refactored.tsx'; // ✅ SQL-only: Analytics endpoints (Batch 12, 1 KV op removed)
import { bookingEndpoints } from './booking-endpoints-refactored.tsx'; // ✅ SQL-only: Booking endpoints (Batch 12, 1 KV op removed)
import { registerAdminCatalogEndpoints } from './admin-catalog-endpoints-refactored.tsx'; // ✅ SQL-only: Admin catalog endpoints (Batch 12, 1 KV op removed)
import { vendorApprovalWorkflowEndpoints } from './vendor-approval-workflow-refactored.tsx'; // ✅ SQL-only: Vendor approval workflow (Batch 12, 1 KV op removed)
import { adminVendorEndpoints } from './admin-vendor-endpoints-refactored.tsx'; // ✅ SQL-only: Admin vendor endpoints (Batch 12, 1 KV op removed)
// ✅ NEW: Batch 13 SQL-only endpoints
import enhancedStaffAvailabilityRoutesSQL from './enhanced-staff-availability-routes-sql.tsx'; // ✅ SQL-only: Enhanced staff availability routes (Batch 13, 6 KV ops removed)
// ✅ NEW: Auth endpoints (SQL-only)
import { registerAuthEndpoints } from './auth-endpoints-sql.tsx'; // ✅ SQL-only: Auth endpoints (5 KV ops removed - debug endpoint migrated)
// ✅ NEW: Additional SQL-only endpoints (missing registrations)
import { serviceStyleManagement } from './service-style-management-sql.tsx'; // ✅ SQL-only: Service style management
import { servicesByProblemEndpoints } from './services-by-problem-sql.tsx'; // ✅ SQL-only: Services by problem
import { registerStorageEndpoints } from './storage-handler-sql.tsx'; // ✅ SQL-only: Storage handler (Batch 35, 0 KV ops - unused import removed)
import { registerSettlementTierSystemSQL } from './settlement-tier-system-sql.tsx'; // ✅ SQL-only: Settlement tier system
import groomingBookingAPIs from './grooming-booking-apis-sql.tsx'; // ✅ SQL-only: Grooming booking APIs
import { smsNotificationServiceEnhanced } from './sms-notification-service-enhanced-sql.tsx'; // ✅ SQL-only: SMS notification service
// ✅ NEW: Batch 14 - Additional SQL-only endpoints
import { registerMatingDatingServiceSQL } from './mating-dating-service-sql.tsx'; // ✅ SQL-only: Mating dating service (Batch 14, 55 KV ops removed)
import { registerReverificationEndpointsSQL } from './reverification-sql.tsx'; // ✅ SQL-only: Reverification (Batch 14, 48 KV ops removed)
import { registerChatEndpoints } from './chat-endpoints-sql.tsx'; // ✅ SQL-only: Chat endpoints (Batch 14, 43 KV ops removed)
// ✅ NEW: Batch 15 - Additional SQL-only endpoints
import { registerPlatformSubscriptionTiersSQL } from './platform-subscription-tiers-sql.tsx'; // ✅ SQL-only: Platform subscription tiers (Batch 15, 36 KV ops removed)
import { refundReschedulingEndpointsSQL } from './refund-rescheduling-complete-sql.tsx'; // ✅ SQL-only: Refund rescheduling complete (Batch 15, 35 KV ops removed)
import { vetSpecializedServicesSQL } from './vet-specialized-services-sql.tsx'; // ✅ SQL-only: Vet specialized services (Batch 15, 34 KV ops removed)
// ✅ NEW: Batch 16 - Additional SQL-only endpoints
// Note: automatedPayoutEndpointsSQL already imported at line 135 (Batch 1)
import { registerUniversalCustomerSearch } from './universal-customer-search-sql.tsx'; // ✅ SQL-only: Universal customer search (Batch 16, 27 KV ops removed)
// ✅ NEW: Batch 17 - Additional SQL-only endpoints
// Note: logisticsPartnerIntegrationEndpointsSQL and foodDeliveryHyperlocalEndpointsSQL already registered in Batch 9
import { vendorSettingsRulesEndpointsSQL } from './vendor-settings-rules-sql.tsx'; // ✅ SQL-only: Vendor settings rules (Batch 17, 33 KV ops removed)
// ✅ NEW: Batch 18 - Additional SQL-only endpoints
// Note: referralSystemSQL already imported at line 161 (Batch 19)
import { registerUniversalStaffSchedule } from './universal-staff-schedule-sql.tsx'; // ✅ SQL-only: Universal staff schedule (Batch 18, 24 KV ops removed)
import razorpayPaymentIntegrationSQL from './razorpay-payment-integration-sql.tsx'; // ✅ SQL-only: Razorpay payment integration (Batch 18, 23 KV ops removed)
// Note: vendor-utils-sql.tsx exports utility functions (saveVendor, etc.) - not an endpoint registration
// ✅ NEW: Batch 19 - Additional SQL-only endpoints
// Note: petEndpoints, medicineReorderEndpointsSQL, gstConfigurationEndpointsSQL, nutritionistSystemEndpointsSQL, paymentRazorpayEndpointsSQL already imported at lines 162, 163, 214, 234, 238
import { registerUniversalOTPSystemSQL } from './universal-otp-system-sql.tsx'; // ✅ SQL-only: Universal OTP system (Batch 19, 21 KV ops removed)
// ✅ NEW: Batch 20 - Additional SQL-only endpoints
// Note: catalogEndpointsSQL already imported at line 34, enhancedRefundSystemSQL at line 207, systemOptimizationEndpoints at line 247
// ✅ NEW: Batch 21 - Additional SQL-only endpoints
// Note: staffScheduleEndpointsSQL already imported at line 35, reschedulingPoliciesEndpointsSQL at line 36, settlementScheduleEndpointsSQL at line 146
import missingCrudEndpointsSQL from './missing-crud-endpoints-sql.tsx'; // ✅ SQL-only: Missing CRUD endpoints (Batch 14, 39 KV ops removed)
import { registerP0Features } from './p0-features-endpoints-sql.tsx'; // ✅ SQL-only: P0 features endpoints (Batch 14, ~35 KV ops removed)
import { followupEndpointsSQL } from './followup-endpoints-sql.tsx'; // ✅ SQL-only: Followup endpoints (Batch 14, ~30 KV ops removed)

// Create Hono app instance
const app = new Hono();

// Register endpoint modules
try {
  console.log('✅ Registering auth endpoints (SQL-only)...');
  registerAuthEndpoints(app);
} catch (error) {
  console.error('❌ Error registering auth endpoints:', error);
}

try {
  console.log('✅ Registering service style management (SQL-only)...');
  serviceStyleManagement(app);
} catch (error) {
  console.error('❌ Error registering service style management:', error);
}

try {
  console.log('✅ Registering services by problem endpoints (SQL-only)...');
  servicesByProblemEndpoints(app);
} catch (error) {
  console.error('❌ Error registering services by problem endpoints:', error);
}

try {
  console.log('✅ Registering storage handler endpoints (SQL-only)...');
  registerStorageEndpoints(app);
} catch (error) {
  console.error('❌ Error registering storage handler endpoints:', error);
}

try {
  console.log('✅ Registering settlement tier system (SQL-only)...');
  registerSettlementTierSystemSQL(app);
} catch (error) {
  console.error('❌ Error registering settlement tier system:', error);
}

try {
  console.log('✅ Registering grooming booking APIs (SQL-only)...');
  app.route('/make-server-3dd53475', groomingBookingAPIs);
} catch (error) {
  console.error('❌ Error registering grooming booking APIs:', error);
}

try {
  console.log('✅ Registering SMS notification service enhanced (SQL-only)...');
  smsNotificationServiceEnhanced(app);
} catch (error) {
  console.error('❌ Error registering SMS notification service:', error);
}

try {
  console.log('✅ Registering region endpoints...');
  regionEndpoints(app);
} catch (error) {
  console.error('❌ Error registering region endpoints:', error);
}

try {
  console.log('✅ Registering onboarding form API...');
  onboardingFormAPI(app);
} catch (error) {
  console.error('❌ Error registering onboarding form API:', error);
}

try {
  console.log('✅ Registering onboarding config endpoints (vendor applications)...');
  onboardingConfigEndpoints(app);
} catch (error) {
  console.error('❌ Error registering onboarding config endpoints:', error);
}

try {
  console.log('✅ Registering vendor onboarding endpoints (SQL-only)...');
  vendorOnboardingEndpoints(app);
} catch (error) {
  console.error('❌ Error registering vendor onboarding endpoints:', error);
}

try {
  console.log('✅ Registering admin vendor routes (applications, approve, reject)...');
  registerAdminVendorRoutes(app);
} catch (error) {
  console.error('❌ Error registering admin vendor routes:', error);
}

try {
  console.log('✅ Registering customer routes (SQL-only)...');
  registerCustomerRoutes(app);
} catch (error) {
  console.error('❌ Error registering customer routes:', error);
}

try {
  console.log('✅ Registering role config endpoints (config/roles)...');
  roleConfigEndpoints(app);
} catch (error) {
  console.error('❌ Error registering role config endpoints:', error);
}

try {
  console.log('✅ Registering catalog endpoints (admin/catalog)...');
  catalogEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering catalog endpoints:', error);
}

try {
  console.log('✅ Registering staff schedule endpoints...');
  staffScheduleEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering staff schedule endpoints:', error);
}

try {
  console.log('✅ Registering rescheduling policies endpoints...');
  reschedulingPoliciesEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering rescheduling policies endpoints:', error);
}

try {
  console.log('✅ Registering search endpoints...');
  searchEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering search endpoints:', error);
}

try {
  console.log('✅ Registering Agora video integration endpoints...');
  agoraVideoEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering Agora video integration endpoints:', error);
}

try {
  console.log('✅ Registering event management endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', eventManagementEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering event management endpoints:', error);
}

try {
  console.log('✅ Registering donation management endpoints (SQL-only)...');
  donationManagementEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering donation management endpoints:', error);
}

try {
  console.log('✅ Registering nutritionist food delivery endpoints...');
  nutritionistFoodDeliveryEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering nutritionist food delivery endpoints:', error);
}

// ✅ NEW: Batch 13 SQL-only endpoint registrations
try {
  console.log('✅ Registering staff discovery endpoints (SQL-only)...');
  staffDiscoveryEndpoints(app);
} catch (error) {
  console.error('❌ Error registering staff discovery endpoints:', error);
}

try {
  console.log('✅ Registering standardized OTP endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', standardizedOtpEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering standardized OTP endpoints:', error);
}

try {
  console.log('✅ Registering appointment lifecycle endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', appointmentLifecycleEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering appointment lifecycle endpoints:', error);
}

try {
  console.log('✅ Registering transaction monitoring endpoints (SQL-only)...');
  transactionMonitoringEndpoints(app);
} catch (error) {
  console.error('❌ Error registering transaction monitoring endpoints:', error);
}

// ✅ NEW: Batch 14 SQL-only endpoint registrations
try {
  console.log('✅ Registering system health check (SQL-only)...');
  app.route('/make-server-3dd53475', systemHealthCheckSQL);
} catch (error) {
  console.error('❌ Error registering system health check:', error);
}

try {
  console.log('✅ Registering customer wallet top-up (SQL-only)...');
  app.route('/make-server-3dd53475', customerWalletTopupSQL);
} catch (error) {
  console.error('❌ Error registering customer wallet top-up:', error);
}

try {
  console.log('✅ Registering enhanced GPS tracking (SQL-only)...');
  app.route('/make-server-3dd53475', enhancedGpsTrackingSQL);
} catch (error) {
  console.error('❌ Error registering enhanced GPS tracking:', error);
}

try {
  console.log('✅ Registering universal staff search (SQL-only)...');
  app.route('/make-server-3dd53475', universalStaffSearchSQL);
} catch (error) {
  console.error('❌ Error registering universal staff search:', error);
}

// Removed duplicate registration of nutritionistFoodDeliveryEndpointsSQL (already registered above)

try {
  console.log('✅ Registering previous providers (SQL-only)...');
  previousProvidersEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering previous providers:', error);
}

try {
  console.log('✅ Registering nutritionist diet plans (SQL-only)...');
  nutritionistDietPlanEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering nutritionist diet plans:', error);
}

try {
  console.log('✅ Registering medical history (SQL-only)...');
  registerMedicalHistoryEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering medical history:', error);
}

try {
  console.log('✅ Registering logistics partner integration (SQL-only)...');
  logisticsPartnerIntegrationEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering logistics partner integration:', error);
}

try {
  console.log('✅ Registering food delivery hyperlocal (SQL-only)...');
  foodDeliveryHyperlocalEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering food delivery hyperlocal:', error);
}

try {
  console.log('✅ Registering additional capabilities (SQL-only)...');
  app.route('/make-server-3dd53475', additionalCapabilitiesEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering additional capabilities:', error);
}

try {
  console.log('✅ Registering report builder (SQL-only)...');
  reportBuilderEndpoints(app);
} catch (error) {
  console.error('❌ Error registering report builder:', error);
}

try {
  console.log('✅ Registering analytics dashboard sprint 2 (SQL-only)...');
  registerAnalyticsDashboardSprint2SQL(app);
} catch (error) {
  console.error('❌ Error registering analytics dashboard sprint 2:', error);
}

try {
  console.log('✅ Registering tier upgrade endpoints (SQL-only)...');
  tierUpgradeEndpoints(app);
} catch (error) {
  console.error('❌ Error registering tier upgrade endpoints:', error);
}

try {
  console.log('✅ Registering video call endpoints (SQL-only)...');
  registerVideoCallEndpoints(app);
} catch (error) {
  console.error('❌ Error registering video call endpoints:', error);
}

try {
  console.log('✅ Registering AWS Chime video endpoints (SQL-only)...');
  registerAWSChimeVideoEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering AWS Chime video endpoints:', error);
}

try {
  console.log('✅ Registering AWS Chime chat endpoints (SQL-only)...');
  registerAWSChimeChatEndpoints(app);
} catch (error) {
  console.error('❌ Error registering AWS Chime chat endpoints:', error);
}

try {
  console.log('✅ Registering dynamic onboarding fields (SQL-only)...');
  app.route('/make-server-3dd53475', dynamicOnboardingFieldsSQL);
} catch (error) {
  console.error('❌ Error registering dynamic onboarding fields:', error);
}

try {
  console.log('✅ Registering booking lifecycle (SQL-only)...');
  registerBookingLifecycleEndpoints(app);
} catch (error) {
  console.error('❌ Error registering booking lifecycle:', error);
}

try {
  console.log('✅ Registering service comparison system (SQL-only)...');
  app.route('/make-server-3dd53475', serviceComparisonSystemSQL);
} catch (error) {
  console.error('❌ Error registering service comparison system:', error);
}

try {
  console.log('✅ Registering vendor profile update (SQL-only)...');
  registerVendorProfileUpdateEndpoints(app);
} catch (error) {
  console.error('❌ Error registering vendor profile update:', error);
}

// ✅ NEW: Batch 15 SQL-only endpoint registrations (additional ones)
try {
  console.log('✅ Registering independent vendor system (SQL-only)...');
  independentVendorSystemEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering independent vendor system:', error);
}

try {
  console.log('✅ Registering dating chat endpoints (SQL-only)...');
  registerDatingChatEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering dating chat endpoints:', error);
}

try {
  console.log('✅ Registering scheduled tele booking endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', scheduledTeleBookingSQL);
} catch (error) {
  console.error('❌ Error registering scheduled tele booking endpoints:', error);
}

try {
  console.log('✅ Registering integrated services manager endpoints (SQL-only)...');
  integratedServicesManagerEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering integrated services manager endpoints:', error);
}

try {
  console.log('✅ Registering tier commission integration (SQL-only)...');
  tierCommissionIntegrationEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering tier commission integration:', error);
}

try {
  console.log('✅ Registering staff service style setup (SQL-only)...');
  staffServiceStyleSetupEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering staff service style setup:', error);
}

try {
  console.log('✅ Registering memorial endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', memorialEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering memorial endpoints:', error);
}

// ✅ NEW: Batch 16 SQL-only endpoint registrations
try {
  console.log('✅ Registering integrated services complete (SQL-only)...');
  app.route('/make-server-3dd53475', integratedServicesCompleteSQL);
} catch (error) {
  console.error('❌ Error registering integrated services:', error);
}

try {
  console.log('✅ Registering advanced search engine (SQL-only)...');
  app.route('/make-server-3dd53475', advancedSearchEngineSQL);
} catch (error) {
  console.error('❌ Error registering advanced search engine:', error);
}

try {
  console.log('✅ Registering vendor analytics (SQL-only)...');
  app.route('/make-server-3dd53475', vendorAnalyticsEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering vendor analytics:', error);
}

try {
  console.log('✅ Registering search analytics API (SQL-only)...');
  app.route('/make-server-3dd53475', searchAnalyticsAPISQL);
} catch (error) {
  console.error('❌ Error registering search analytics:', error);
}

try {
  console.log('✅ Registering health problem endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', healthProblemEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering health problem endpoints:', error);
}

try {
  console.log('✅ Registering elasticsearch proxy (SQL-only)...');
  app.route('/make-server-3dd53475', elasticsearchProxySQL);
} catch (error) {
  console.error('❌ Error registering elasticsearch proxy:', error);
}

try {
  console.log('✅ Registering automated bank verification (SQL-only)...');
  app.route('/make-server-3dd53475', automatedBankVerificationSQL);
} catch (error) {
  console.error('❌ Error registering automated bank verification:', error);
}

// ✅ NEW: Batch 17 SQL-only endpoint registrations
try {
  console.log('✅ Registering booking validation endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', bookingValidationEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering booking validation endpoints:', error);
}

try {
  console.log('✅ Registering cancellation policy endpoints (SQL-only)...');
  cancellationPolicyEndpoints(app);
} catch (error) {
  console.error('❌ Error registering cancellation policy endpoints:', error);
}

try {
  console.log('✅ Registering slot availability endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', slotAvailabilityEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering slot availability endpoints:', error);
}

try {
  console.log('✅ Registering nutritionist food integration (SQL-only)...');
  nutritionistFoodIntegrationEndpoints(app);
} catch (error) {
  console.error('❌ Error registering nutritionist food integration:', error);
}

try {
  console.log('✅ Registering refund policy engine (SQL-only)...');
  refundPolicyEndpoints(app);
} catch (error) {
  console.error('❌ Error registering refund policy engine:', error);
}

// ✅ NEW: Batch 18 SQL-only endpoint registrations
try {
  console.log('✅ Registering appointment detail endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', appointmentDetailEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering appointment detail endpoints:', error);
}

try {
  console.log('✅ Registering customer e-commerce endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', customerEcommerceEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering customer e-commerce endpoints:', error);
}

try {
  console.log('✅ Registering customer package endpoints (SQL-only)...');
  registerCustomerPackageEndpoints(app);
} catch (error) {
  console.error('❌ Error registering customer package endpoints:', error);
}

try {
  console.log('✅ Registering customer app enhancements (SQL-only)...');
  registerCustomerAppEnhancementsSQL(app);
} catch (error) {
  console.error('❌ Error registering customer app enhancements:', error);
}

try {
  console.log('✅ Registering appointment reminder system (SQL-only)...');
  registerAppointmentReminderSystemSQL(app);
} catch (error) {
  console.error('❌ Error registering appointment reminder system:', error);
}

try {
  console.log('✅ Registering consultation notes endpoints (SQL-only)...');
  consultationNotesEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering consultation notes endpoints:', error);
}

try {
  console.log('✅ Registering pharmacy prescription endpoints (SQL-only)...');
  pharmacyPrescriptionEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering pharmacy prescription endpoints:', error);
}

try {
  console.log('✅ Registering customer medical records endpoints (SQL-only)...');
  registerCustomerMedicalRecordsEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering customer medical records endpoints:', error);
}

// ✅ NEW: Batch 19 SQL-only endpoint registrations
try {
  console.log('✅ Registering patient monitoring endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', patientMonitoringEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering patient monitoring endpoints:', error);
}

try {
  console.log('✅ Registering critical flow fixes (SQL-only)...');
  registerCriticalFlowFixesSQL(app);
} catch (error) {
  console.error('❌ Error registering critical flow fixes:', error);
}

try {
  console.log('✅ Registering enhanced service publishing (SQL-only)...');
  app.route('/make-server-3dd53475', enhancedServicePublishingSQL);
} catch (error) {
  console.error('❌ Error registering enhanced service publishing:', error);
}

try {
  console.log('✅ Registering multi-service scheduling endpoints (SQL-only)...');
  multiServiceSchedulingEndpoints(app);
} catch (error) {
  console.error('❌ Error registering multi-service scheduling endpoints:', error);
}

try {
  console.log('✅ Registering QA gap fixes (SQL-only)...');
  registerQaGapFixesSQL(app);
} catch (error) {
  console.error('❌ Error registering QA gap fixes:', error);
}

try {
  console.log('✅ Registering referral system endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', referralSystemSQL);
} catch (error) {
  console.error('❌ Error registering referral system endpoints:', error);
}

try {
  console.log('✅ Registering pet endpoints (SQL-only)...');
  petEndpoints(app);
} catch (error) {
  console.error('❌ Error registering pet endpoints:', error);
}

try {
  console.log('✅ Registering medicine reorder endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', medicineReorderEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering medicine reorder endpoints:', error);
}

// ✅ NEW: Batch 21 SQL-only endpoint registrations
try {
  console.log('✅ Registering adoption endpoints (SQL-only)...');
  app.route('/make-server-3dd53475/vendor/adoption', adoptionEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering adoption endpoints:', error);
}

try {
  console.log('✅ Registering analytics aggregation endpoints (SQL-only)...');
  analyticsAggregationEndpoints(app);
} catch (error) {
  console.error('❌ Error registering analytics aggregation endpoints:', error);
}

try {
  console.log('✅ Registering admin integration endpoints (SQL-only)...');
  adminIntegrationEndpoints(app);
} catch (error) {
  console.error('❌ Error registering admin integration endpoints:', error);
}

try {
  console.log('✅ Registering analytics dashboard endpoints (SQL-only)...');
  analyticsDashboardEndpoints(app);
} catch (error) {
  console.error('❌ Error registering analytics dashboard endpoints:', error);
}

// ✅ NEW: Batch 22 SQL-only endpoint registrations
try {
  console.log('✅ Registering cafe features endpoints (SQL-only)...');
  registerCafeFeatures(app);
} catch (error) {
  console.error('❌ Error registering cafe features endpoints:', error);
}

try {
  console.log('✅ Registering boarding room management endpoints (SQL-only)...');
  registerBoardingRoomManagement(app);
} catch (error) {
  console.error('❌ Error registering boarding room management endpoints:', error);
}

try {
  console.log('✅ Registering notification template system endpoints (SQL-only)...');
  notificationTemplateSystem(app);
} catch (error) {
  console.error('❌ Error registering notification template system endpoints:', error);
}

try {
  console.log('✅ Registering admin service catalog endpoints (SQL-only)...');
  registerAdminServiceCatalogSQL(app);
} catch (error) {
  console.error('❌ Error registering admin service catalog endpoints:', error);
}

try {
  console.log('✅ Registering admin e-commerce dashboard endpoints (SQL-only)...');
  adminEcommerceDashboardEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering admin e-commerce dashboard endpoints:', error);
}

// ✅ NEW: Batch 23 SQL-only endpoint registrations
try {
  console.log('✅ Registering advertising endpoints (SQL-only)...');
  advertisingEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering advertising endpoints:', error);
}

try {
  console.log('✅ Registering advanced search API endpoints (SQL-only)...');
  advancedSearchAPISQL(app);
} catch (error) {
  console.error('❌ Error registering advanced search API endpoints:', error);
}

try {
  console.log('✅ Registering banner endpoints (SQL-only)...');
  registerBannerEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering banner endpoints:', error);
}

try {
  console.log('✅ Registering content management endpoints (SQL-only)...');
  registerContentManagementEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering content management endpoints:', error);
}

try {
  console.log('✅ Registering coupon endpoints (SQL-only)...');
  registerCouponEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering coupon endpoints:', error);
}

// ✅ NEW: Batch 24 SQL-only endpoint registrations
try {
  console.log('✅ Registering clinic doctor endpoints (SQL-only)...');
  registerClinicDoctorEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering clinic doctor endpoints:', error);
}

try {
  console.log('✅ Registering controlled substances endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', controlledSubstancesEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering controlled substances endpoints:', error);
}

try {
  console.log('✅ Registering vendor management endpoints (SQL-only)...');
  vendorManagementEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering vendor management endpoints:', error);
}

try {
  console.log('✅ Registering backwards compatible endpoints (SQL-only)...');
  backwardsCompatibleEndpoints(app);
} catch (error) {
  console.error('❌ Error registering backwards compatible endpoints:', error);
}

try {
  console.log('✅ Registering booking lifecycle management endpoints (SQL-only)...');
  registerBookingLifecycleManagement(app);
} catch (error) {
  console.error('❌ Error registering booking lifecycle management endpoints:', error);
}

try {
  console.log('✅ Registering center availability endpoints (SQL-only)...');
  centerAvailabilityEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering center availability endpoints:', error);
}

// ✅ NEW: Batch 25 SQL-only endpoint registrations
try {
  console.log('✅ Registering customer pets routes (SQL-only)...');
  app.route('/make-server-3dd53475/customer/pets', customerPetsRoutes);
} catch (error) {
  console.error('❌ Error registering customer pets routes:', error);
}

try {
  console.log('✅ Registering customer search endpoints (SQL-only)...');
  registerCustomerSearchEndpoints(app);
} catch (error) {
  console.error('❌ Error registering customer search endpoints:', error);
}

try {
  console.log('✅ Registering dating chat endpoints (SQL-only)...');
  registerDatingChatSQL(app);
} catch (error) {
  console.error('❌ Error registering dating chat endpoints:', error);
}

try {
  console.log('✅ Registering Delhivery integration endpoints (SQL-only)...');
  registerDelhiveryIntegrationSQL(app);
} catch (error) {
  console.error('❌ Error registering Delhivery integration endpoints:', error);
}

try {
  console.log('✅ Registering delivery integration endpoints (SQL-only)...');
  deliveryIntegrationEndpoints(app);
} catch (error) {
  console.error('❌ Error registering delivery integration endpoints:', error);
}

// ✅ NEW: Batch 26 SQL-only endpoint registrations
try {
  console.log('✅ Registering doctor discovery endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', doctorDiscoveryEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering doctor discovery endpoints:', error);
}

try {
  console.log('✅ Registering e-commerce policies endpoints (SQL-only)...');
  ecommercePoliciesEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering e-commerce policies endpoints:', error);
}

try {
  console.log('✅ Registering e-commerce routes (SQL-only)...');
  ecommerceRoutesSQL(app);
} catch (error) {
  console.error('❌ Error registering e-commerce routes:', error);
}

try {
  console.log('✅ Registering Elasticsearch complete endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', elasticsearchCompleteSQL);
} catch (error) {
  console.error('❌ Error registering Elasticsearch complete endpoints:', error);
}

try {
  console.log('✅ Registering enhanced refund system endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', enhancedRefundSystemSQL);
} catch (error) {
  console.error('❌ Error registering enhanced refund system endpoints:', error);
}

// ✅ NEW: Batch 27 SQL-only endpoint registrations
try {
  console.log('✅ Registering facility endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', facilityEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering facility endpoints:', error);
}

try {
  console.log('✅ Registering followup endpoints (SQL-only)...');
  followupEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering followup endpoints:', error);
}

try {
  console.log('✅ Registering groomer gallery system endpoints (SQL-only)...');
  registerGroomerGalleryEndpoints(app);
} catch (error) {
  console.error('❌ Error registering groomer gallery system endpoints:', error);
}

try {
  console.log('✅ Registering gap fixes comprehensive endpoints (SQL-only)...');
  comprehensiveGapFixesSQL(app);
} catch (error) {
  console.error('❌ Error registering gap fixes comprehensive endpoints:', error);
}

// ✅ NEW: Batch 28 SQL-only endpoint registrations
try {
  console.log('✅ Registering GST configuration endpoints (SQL-only)...');
  gstConfigurationEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering GST configuration endpoints:', error);
}

try {
  console.log('✅ Registering holiday package endpoints (SQL-only)...');
  holidayPackageEndpoints(app);
} catch (error) {
  console.error('❌ Error registering holiday package endpoints:', error);
}

try {
  console.log('✅ Registering holiday package system endpoints (SQL-only)...');
  holidayPackageSystemEndpoints(app);
} catch (error) {
  console.error('❌ Error registering holiday package system endpoints:', error);
}

try {
  console.log('✅ Registering home sample collection endpoints (SQL-only)...');
  homeSampleCollectionEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering home sample collection endpoints:', error);
}

try {
  console.log('✅ Registering instant tele booking endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', instantTeleBookingSQL);
} catch (error) {
  console.error('❌ Error registering instant tele booking endpoints:', error);
}

try {
  console.log('✅ Registering instant tele endpoints (SQL-only)...');
  instantTeleEndpoints(app);
} catch (error) {
  console.error('❌ Error registering instant tele endpoints:', error);
}

try {
  console.log('✅ Registering insurance endpoints (SQL-only)...');
  insuranceEndpoints(app);
} catch (error) {
  console.error('❌ Error registering insurance endpoints:', error);
}

try {
  console.log('✅ Registering invoice endpoints (SQL-only)...');
  invoiceEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering invoice endpoints:', error);
}

// ✅ NEW: Batch 29 SQL-only endpoint registrations
try {
  console.log('✅ Registering loyalty endpoints (SQL-only)...');
  registerLoyaltyEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering loyalty endpoints:', error);
}

try {
  console.log('✅ Registering marketing routes v2 (SQL-only)...');
  app.route('/make-server-3dd53475', marketingRoutesV2SQL);
} catch (error) {
  console.error('❌ Error registering marketing routes v2:', error);
}

try {
  console.log('✅ Registering home service booking flow (SQL-only)...');
  registerHomeServiceBookingFlow(app);
} catch (error) {
  console.error('❌ Error registering home service booking flow:', error);
}

// ✅ NEW: Batch 30 SQL-only endpoint registrations
try {
  console.log('✅ Registering elasticsearch integration endpoints (SQL-only)...');
  elasticsearchIntegration(app);
} catch (error) {
  console.error('❌ Error registering elasticsearch integration endpoints:', error);
}

try {
  console.log('✅ Registering enhanced staff availability with conflicts (SQL-only)...');
  app.route('/make-server-3dd53475', enhancedStaffAvailabilityWithConflictsSQL);
} catch (error) {
  console.error('❌ Error registering enhanced staff availability with conflicts:', error);
}

try {
  console.log('✅ Registering logistics order integration endpoints (SQL-only)...');
  logisticsOrderIntegrationEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering logistics order integration endpoints:', error);
}

// ✅ NEW: Batch 31 SQL-only endpoint registrations
try {
  console.log('✅ Registering marketplace products endpoints (SQL-only)...');
  registerMarketplaceProducts(app);
} catch (error) {
  console.error('❌ Error registering marketplace products endpoints:', error);
}

try {
  console.log('✅ Registering medical AI summary endpoints (SQL-only)...');
  registerMedicalAISummaryEndpoints(app);
} catch (error) {
  console.error('❌ Error registering medical AI summary endpoints:', error);
}

try {
  console.log('✅ Registering nutritionist meal management endpoints (SQL-only)...');
  registerNutritionistMealManagementSQL(app);
} catch (error) {
  console.error('❌ Error registering nutritionist meal management endpoints:', error);
}

try {
  console.log('✅ Registering nutritionist system endpoints (SQL-only)...');
  nutritionistSystemEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering nutritionist system endpoints:', error);
}

try {
  console.log('✅ Registering order lifecycle complete endpoints (SQL-only)...');
  orderLifecycleCompleteEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering order lifecycle complete endpoints:', error);
}

try {
  console.log('✅ Registering order management endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', orderManagementEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering order management endpoints:', error);
}

try {
  console.log('✅ Registering payment endpoints (SQL-only)...');
  paymentEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering payment endpoints:', error);
}

try {
  console.log('✅ Registering payment Razorpay endpoints (SQL-only)...');
  paymentRazorpayEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering payment Razorpay endpoints:', error);
}

// ✅ NEW: Batch 32 SQL-only endpoint registrations
try {
  console.log('✅ Registering payment settlement integration endpoints (SQL-only)...');
  paymentSettlementIntegrationEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering payment settlement integration endpoints:', error);
}

try {
  console.log('✅ Registering performance monitoring endpoints (SQL-only)...');
  performanceMonitoringEndpoints(app);
} catch (error) {
  console.error('❌ Error registering performance monitoring endpoints:', error);
}

try {
  console.log('✅ Registering pet intelligence endpoints (SQL-only)...');
  petIntelligenceEndpoints(app);
} catch (error) {
  console.error('❌ Error registering pet intelligence endpoints:', error);
}

try {
  console.log('✅ Registering pet profile publishing endpoints (SQL-only)...');
  petProfilePublishingEndpoints(app);
} catch (error) {
  console.error('❌ Error registering pet profile publishing endpoints:', error);
}

try {
  console.log('✅ Registering portfolio endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', portfolioEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering portfolio endpoints:', error);
}

try {
  console.log('✅ Registering problem grid specialization system endpoints (SQL-only)...');
  registerProblemGridSpecializationSystem(app);
} catch (error) {
  console.error('❌ Error registering problem grid specialization system endpoints:', error);
}

// ✅ NEW: Batch 33 SQL-only endpoint registrations
try {
  console.log('✅ Registering system optimization endpoints (SQL-only)...');
  systemOptimizationEndpoints(app);
} catch (error) {
  console.error('❌ Error registering system optimization endpoints:', error);
}

try {
  console.log('✅ Registering training progress endpoints (SQL-only)...');
  trainingProgressEndpoints(app);
} catch (error) {
  console.error('❌ Error registering training progress endpoints:', error);
}

// ✅ NEW: Batch 34 SQL-only endpoint registrations
try {
  console.log('✅ Registering profit margin endpoints (SQL-only)...');
  profitMarginEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering profit margin endpoints:', error);
}

try {
  console.log('✅ Registering promotion endpoints (SQL-only)...');
  promotionEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering promotion endpoints:', error);
}

try {
  console.log('✅ Registering resort inventory endpoints (SQL-only)...');
  registerResortInventory(app);
} catch (error) {
  console.error('❌ Error registering resort inventory endpoints:', error);
}

try {
  console.log('✅ Registering resort precheck endpoints (SQL-only)...');
  resortPreCheckEndpoints(app);
} catch (error) {
  console.error('❌ Error registering resort precheck endpoints:', error);
}

try {
  console.log('✅ Registering returns management endpoints (SQL-only)...');
  registerReturnsManagementEndpoints(app);
} catch (error) {
  console.error('❌ Error registering returns management endpoints:', error);
}

try {
  console.log('✅ Registering bank verification endpoints (SQL-only)...');
  bankVerificationEndpoints(app);
} catch (error) {
  console.error('❌ Error registering bank verification endpoints:', error);
}

try {
  console.log('✅ Registering expiry management endpoints (SQL-only)...');
  registerExpiryManagementEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering expiry management endpoints:', error);
}

try {
  console.log('✅ Registering cafe table management (SQL-only)...');
  app.route('/make-server-3dd53475', cafeTableManagementSQL);
} catch (error) {
  console.error('❌ Error registering cafe table management:', error);
}

// Removed duplicate registration of scheduledTeleBookingSQL (already registered above)

// Removed duplicate registration of integratedServicesManagerEndpointsSQL (already registered above)

try {
  console.log('✅ Registering Razorpay marketplace settlement (SQL-only)...');
  razorpayMarketplaceSettlementSQL(app);
} catch (error) {
  console.error('❌ Error registering Razorpay marketplace settlement:', error);
}

// ✅ NEW: Batch 10 Phase 1 SQL-only endpoints
try {
  console.log('✅ Registering staff specialization system (SQL-only)...');
  staffSpecializationEndpoints(app);
} catch (error) {
  console.error('❌ Error registering staff specialization system:', error);
}

try {
  console.log('✅ Registering universal staff problem search (SQL-only)...');
  app.route('/make-server-3dd53475', universalStaffProblemSearchSQL);
} catch (error) {
  console.error('❌ Error registering universal staff problem search:', error);
}

// ✅ NEW: Batch 10 Phase 2 SQL-only endpoints
try {
  console.log('✅ Registering unified service discovery (SQL-only)...');
  unifiedServiceDiscoveryEndpoints(app);
} catch (error) {
  console.error('❌ Error registering unified service discovery:', error);
}

try {
  console.log('✅ Registering vendor bank validation (SQL-only)...');
  app.route('/make-server-3dd53475', vendorBankValidationSQL);
} catch (error) {
  console.error('❌ Error registering vendor bank validation:', error);
}

try {
  console.log('✅ Registering logistics adapter (SQL-only)...');
  registerLogisticsEndpoints(app);
} catch (error) {
  console.error('❌ Error registering logistics adapter:', error);
}

// ✅ NEW: Batch 10 Phase 3 SQL-only endpoints
try {
  console.log('✅ Registering analytics ingestion (SQL-only)...');
  registerAnalyticsIngestion(app);
} catch (error) {
  console.error('❌ Error registering analytics ingestion:', error);
}

try {
  console.log('✅ Registering schedule settings endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', scheduleSettingsEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering schedule settings endpoints:', error);
}

try {
  console.log('✅ Registering radar location system (SQL-only)...');
  radarLocationSystemEndpoints(app);
} catch (error) {
  console.error('❌ Error registering radar location system:', error);
}

try {
  console.log('✅ Registering vendor catalog API (SQL-only)...');
  registerVendorCatalogAPI(app);
} catch (error) {
  console.error('❌ Error registering vendor catalog API:', error);
}

try {
  console.log('✅ Registering logistics routing engine (SQL-only)...');
  registerLogisticsRoutingEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering logistics routing engine:', error);
}

try {
  console.log('✅ Registering enhanced problem discovery (SQL-only)...');
  app.route('/make-server-3dd53475', enhancedProblemDiscoverySQL);
} catch (error) {
  console.error('❌ Error registering enhanced problem discovery:', error);
}

try {
  console.log('✅ Registering settlement tier system enhanced (SQL-only)...');
  settlementTierSystemEndpoints(app);
} catch (error) {
  console.error('❌ Error registering settlement tier system enhanced:', error);
}

try {
  console.log('✅ Registering vendor metrics enhancement (SQL-only)...');
  registerVendorMetricsEnhancementSQL(app);
} catch (error) {
  console.error('❌ Error registering vendor metrics enhancement:', error);
}

try {
  console.log('✅ Registering performance optimization endpoints (SQL-only)...');
  performanceOptimizationEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering performance optimization endpoints:', error);
}

try {
  console.log('✅ Registering marketplace payment endpoints (SQL-only)...');
  marketplacePaymentEndpoints(app);
} catch (error) {
  console.error('❌ Error registering marketplace payment endpoints:', error);
}

// ✅ NEW: Batch 1 Registration Fixes (Phase 1)
try {
  console.log('✅ Registering payment endpoints (SQL-only)...');
  paymentEndpoints(app);
} catch (error) {
  console.error('❌ Error registering payment endpoints:', error);
}

try {
  console.log('✅ Registering wallet endpoints (SQL-only)...');
  app.route('/make-server-3dd53475/wallet', walletEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering wallet endpoints:', error);
}

// ✅ NEW: Batch 1 Phase 3 - Additional Financial Operations Registrations
try {
  console.log('✅ Registering Razorpay refund processor (SQL-only)...');
  registerRazorpayRefundProcessor(app);
} catch (error) {
  console.error('❌ Error registering Razorpay refund processor:', error);
}

try {
  console.log('✅ Registering Razorpay payment endpoints (SQL-only)...');
  razorpayPaymentEndpoints(app);
} catch (error) {
  console.error('❌ Error registering Razorpay payment endpoints:', error);
}

try {
  console.log('✅ Registering settlement automation (SQL-only)...');
  registerSettlementAutomation(app);
} catch (error) {
  console.error('❌ Error registering settlement automation:', error);
}

try {
  console.log('✅ Registering payout cron job (SQL-only)...');
  registerPayoutCronJob(app);
} catch (error) {
  console.error('❌ Error registering payout cron job:', error);
}

try {
  console.log('✅ Registering admin payout endpoints (SQL-only)...');
  adminPayoutEndpoints(app);
} catch (error) {
  console.error('❌ Error registering admin payout endpoints:', error);
}

try {
  console.log('✅ Registering automated payout processing (SQL-only)...');
  app.route('/make-server-3dd53475', automatedPayoutProcessingSQL);
} catch (error) {
  console.error('❌ Error registering automated payout processing:', error);
}

try {
  console.log('✅ Registering marketplace settlement enhanced (SQL-only)...');
  marketplaceSettlementEnhanced(app);
} catch (error) {
  console.error('❌ Error registering marketplace settlement enhanced:', error);
}

try {
  console.log('✅ Registering marketplace settlement automation (SQL-only)...');
  marketplaceSettlementAutomationEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering marketplace settlement automation:', error);
}

try {
  console.log('✅ Registering automated vendor payouts (SQL-only)...');
  automatedPayoutEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering automated vendor payouts:', error);
}

// ✅ NEW: Batch 10 Additional SQL-only endpoint registrations
try {
  console.log('✅ Registering settlement schedule endpoints (SQL-only)...');
  settlementScheduleEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering settlement schedule endpoints:', error);
}

try {
  console.log('✅ Registering rewards & loyalty system (SQL-only)...');
  app.route('/make-server-3dd53475', rewardsLoyaltySystemSQL);
} catch (error) {
  console.error('❌ Error registering rewards & loyalty system:', error);
}

try {
  console.log('✅ Registering trainer progress tracking (SQL-only)...');
  app.route('/make-server-3dd53475', trainerProgressTrackingSQL);
} catch (error) {
  console.error('❌ Error registering trainer progress tracking:', error);
}

try {
  console.log('✅ Registering vet summary endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', vetSummaryEndpointsSQL);
} catch (error) {
  console.error('❌ Error registering vet summary endpoints:', error);
}

try {
  console.log('✅ Registering diagnostics center endpoints (SQL-only)...');
  diagnosticsCenterEndpoints(app);
} catch (error) {
  console.error('❌ Error registering diagnostics center endpoints:', error);
}

try {
  console.log('✅ Registering specialized services endpoints (SQL-only)...');
  specializedServicesEndpoints(app);
} catch (error) {
  console.error('❌ Error registering specialized services endpoints:', error);
}

try {
  console.log('✅ Registering home services endpoints (SQL-only)...');
  homeServicesEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering home services endpoints:', error);
}

try {
  console.log('✅ Registering home services enhanced (SQL-only)...');
  app.route('/make-server-3dd53475', homeServicesEnhancedSQL);
} catch (error) {
  console.error('❌ Error registering home services enhanced:', error);
}

try {
  console.log('✅ Registering home service auto-assignment (SQL-only)...');
  app.route('/make-server-3dd53475', homeServiceAutoAssignmentSQL);
} catch (error) {
  console.error('❌ Error registering home service auto-assignment:', error);
}

try {
  console.log('✅ Registering ambulance service endpoints (SQL-only)...');
  ambulanceServiceEndpoints(app);
} catch (error) {
  console.error('❌ Error registering ambulance service endpoints:', error);
}

// ✅ NEW: Batch 15 - Register SQL-only endpoints
try {
  console.log('✅ Registering platform subscription tiers (SQL-only)...');
  registerPlatformSubscriptionTiersSQL(app);
} catch (error) {
  console.error('❌ Error registering platform subscription tiers:', error);
}

try {
  console.log('✅ Registering refund rescheduling endpoints (SQL-only)...');
  refundReschedulingEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering refund rescheduling endpoints:', error);
}

try {
  console.log('✅ Registering vet specialized services (SQL-only)...');
  vetSpecializedServicesSQL(app);
} catch (error) {
  console.error('❌ Error registering vet specialized services:', error);
}

// ✅ NEW: Batch 16 - Register SQL-only endpoints
// Note: automatedPayoutEndpointsSQL already registered at line 1301 (Batch 1)

try {
  console.log('✅ Registering universal customer search (SQL-only)...');
  registerUniversalCustomerSearch(app);
} catch (error) {
  console.error('❌ Error registering universal customer search:', error);
}

// ✅ NEW: Batch 17 - Register SQL-only endpoints
// Note: logisticsPartnerIntegrationEndpointsSQL and foodDeliveryHyperlocalEndpointsSQL already registered in Batch 9 (lines 433-443)
try {
  console.log('✅ Registering vendor settings rules (SQL-only)...');
  vendorSettingsRulesEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering vendor settings rules:', error);
}

// ✅ NEW: Batch 18 - Register SQL-only endpoints
// Note: referralSystemSQL already registered at line 777 (Batch 19)
try {
  console.log('✅ Registering universal staff schedule (SQL-only)...');
  registerUniversalStaffSchedule(app);
} catch (error) {
  console.error('❌ Error registering universal staff schedule:', error);
}

try {
  console.log('✅ Registering Razorpay payment integration (SQL-only)...');
  app.route('/make-server-3dd53475', razorpayPaymentIntegrationSQL);
} catch (error) {
  console.error('❌ Error registering Razorpay payment integration:', error);
}
// Note: vendor-utils-sql.tsx exports utility functions (saveVendor, etc.) - not an endpoint registration

// ✅ NEW: Batch 19 - Register SQL-only endpoints
// Note: petEndpoints, medicineReorderEndpointsSQL, gstConfigurationEndpointsSQL, nutritionistSystemEndpointsSQL, paymentRazorpayEndpointsSQL already registered at lines 789, 796, 1042, 1164, 1192
try {
  console.log('✅ Registering universal OTP system (SQL-only)...');
  registerUniversalOTPSystemSQL(app);
} catch (error) {
  console.error('❌ Error registering universal OTP system:', error);
}

// ✅ NEW: Batch 20 - Register SQL-only endpoints
// Note: catalogEndpointsSQL already registered at line 338, enhancedRefundSystemSQL at line 1011, systemOptimizationEndpoints at line 1249

try {
  console.log('✅ Registering booking management endpoints (SQL-only)...');
  bookingManagementEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering booking management endpoints:', error);
}

try {
  console.log('✅ Registering booking endpoints (SQL-only)...');
  bookingEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering booking endpoints:', error);
}

try {
  console.log('✅ Registering vendor booking actions endpoints (SQL-only)...');
  vendorBookingActionsEndpointsSQL(app);
} catch (error) {
  console.error('❌ Error registering vendor booking actions endpoints:', error);
}

try {
  console.log('✅ Registering vendor bookings endpoints (SQL-only)...');
  app.route('/make-server-3dd53475', vendorBookingsSQL);
} catch (error) {
  console.error('❌ Error registering vendor bookings endpoints:', error);
}

// ✅ NEW: Batch 21 - Register SQL-only endpoints
// Note: staffScheduleEndpointsSQL already registered at line 353, reschedulingPoliciesEndpointsSQL at line 360, settlementScheduleEndpointsSQL at line 1527

try {
  console.log('✅ Registering subscription endpoints (SQL-only)...');
  registerSubscriptionEndpoints(app);
} catch (error) {
  console.error('❌ Error registering subscription endpoints:', error);
}

try {
  console.log('✅ Registering SMS OTP service (SQL-only)...');
  registerSmsOtpService(app);
} catch (error) {
  console.error('❌ Error registering SMS OTP service:', error);
}

// ✅ NEW: Batch 13 SQL-only endpoint registrations
try {
  console.log('✅ Registering enhanced staff availability routes (SQL-only)...');
  app.route('/make-server-3dd53475', enhancedStaffAvailabilityRoutesSQL);
} catch (error) {
  console.error('❌ Error registering enhanced staff availability routes:', error);
}

// Health endpoint (simple, no dependencies)
app.get('/make-server-3dd53475/health', (c) => {
  const origin = c.req.header('origin');
  return c.json({ status: 'ok', timestamp: new Date().toISOString() }, 200, {
    ...buildCorsHeaders(origin),
  });
});

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const origin = req.headers.get("origin");

  // 1) Always answer preflight FIRST - this is critical for CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: buildCorsHeaders(origin) });
  }

  // 2) Try Hono app for all other requests
  try {
    const response = await app.fetch(req);
    
    // Ensure CORS headers are on the response
    const headers = new Headers(response.headers);
    const corsHeaders = buildCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  } catch (error) {
    console.error('❌ [TOP-LEVEL] Error handling request:', error);
    return json({ 
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : String(error)
    }, 500, origin);
  }
});