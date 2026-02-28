/**
 * ============================================================================
 * MISCELLANEOUS ROUTES
 * ============================================================================
 * 
 * Route registration for remaining endpoints
 * 
 * Date: 2026-01-28
 * Phase 8: Remaining domains restructuring
 * ============================================================================
 */

import { Hono } from 'hono';

// Import from original backend (to be extracted to controllers/)
import { registerGpsTrackingEndpoints } from '../endpoints/gps-tracking';
import { registerTrackingEndpoints } from '../endpoints/tracking';
import { registerAnalyticsEndpoints } from '../endpoints/analytics';
import { registerLoyaltyEndpoints } from '../endpoints/loyalty';
import { registerPackageEndpoints } from '../endpoints/packages';
import { registerPrescriptionEndpoints } from '../endpoints/prescriptions';
import { registerMedicalRecordsEndpoints } from '../endpoints/medical-records';
import { registerMealPlanEndpoints } from '../endpoints/meal-plans';
import { registerNutritionOrderEndpoints } from '../endpoints/nutrition-orders';
import { registerInsuranceEndpoints } from '../endpoints/insurance';
import { registerTrainingProgressEndpoints } from '../endpoints/training-progress';
import { registerWalkerGPSEndpoints } from '../endpoints/walker-gps';
import { registerPromotionEndpoints } from '../endpoints/promotions';
import { registerAdsRecommendationEndpoints } from '../endpoints/ads-recommendations';
import { registerEventEndpoints } from '../endpoints/events';
import { registerHealthEndpoints } from '../endpoints/health';
import { registerDonationEndpoints } from '../endpoints/donations';
import { registerReportEndpoints } from '../endpoints/reports';
import { registerChatEndpoints } from '../endpoints/chat';
import { registerFileUploadEndpoints } from '../endpoints/file-upload';
import { registerSubscriptionEndpoints } from '../endpoints/subscriptions';
import { registerSmsNotificationEndpoints } from '../endpoints/sms-notifications';
import { registerSystemHealthEndpoints } from '../endpoints/system-health';
import { registerNotificationSystemEndpoints } from '../endpoints/notification-system';

/**
 * Register all remaining routes
 */
export function registerMiscRoutes(app: Hono) {
  registerGpsTrackingEndpoints(app);
  registerTrackingEndpoints(app);
  registerAnalyticsEndpoints(app);
  registerLoyaltyEndpoints(app);
  registerPackageEndpoints(app);
  registerPrescriptionEndpoints(app);
  registerMedicalRecordsEndpoints(app);
  registerMealPlanEndpoints(app);
  registerNutritionOrderEndpoints(app);
  registerInsuranceEndpoints(app);
  registerTrainingProgressEndpoints(app);
  registerWalkerGPSEndpoints(app);
  registerPromotionEndpoints(app);
  registerAdsRecommendationEndpoints(app);
  registerEventEndpoints(app);
  registerHealthEndpoints(app);
  registerDonationEndpoints(app);
  registerReportEndpoints(app);
  registerChatEndpoints(app);
  registerFileUploadEndpoints(app);
  registerSubscriptionEndpoints(app);
  registerSmsNotificationEndpoints(app);
  registerSystemHealthEndpoints(app);
  registerNotificationSystemEndpoints(app);
}
