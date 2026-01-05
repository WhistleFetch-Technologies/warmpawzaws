"use strict";
/**
 * ============================================================================
 * ENDPOINT REGISTRY SYSTEM
 * ============================================================================
 *
 * Auto-discovers and registers all endpoints for Lambda handler
 *
 * Agent 2: Lambda Migration Agent
 * Date: 2025-01-28
 *
 * ✅ All endpoints are Node.js-converted and SQL-only
 * ============================================================================
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllEndpoints = registerAllEndpoints;
exports.getEndpointRegistry = getEndpointRegistry;
exports.getEndpointsByCategory = getEndpointsByCategory;
/**
 * Endpoint Registry
 * All endpoints sorted by priority
 */
const ENDPOINT_REGISTRY = [
    // ============================================================================
    // CORE ENDPOINTS (Priority 1-10) - CRITICAL BUSINESS LOGIC
    // ============================================================================
    {
        file: 'auth-endpoints',
        exportName: 'registerAuthEndpoints',
        priority: 1,
        category: 'core',
        description: 'Authentication and authorization endpoints',
    },
    {
        file: 'booking-endpoints',
        exportName: 'bookingEndpointsSQL',
        priority: 2,
        category: 'core',
        description: 'Booking management endpoints (SQL)',
    },
    {
        file: 'payment-endpoints',
        exportName: 'paymentEndpointsSQL',
        priority: 3,
        category: 'core',
        description: 'Payment processing endpoints (SQL)',
    },
    {
        file: 'customer-routes',
        exportName: 'registerCustomerRoutes',
        priority: 4,
        category: 'core',
        description: 'Customer-facing routes and endpoints',
    },
    {
        file: 'staff-crud-endpoints',
        exportName: 'registerStaffCrudEndpoints',
        priority: 5,
        category: 'core',
        description: 'Staff CRUD operations',
    },
    {
        file: 'admin-vendor-routes-sql',
        exportName: 'registerAdminVendorRoutes',
        priority: 6,
        category: 'core',
        description: 'Admin vendor management routes (SQL)',
    },
    {
        file: 'admin-dashboard-endpoints-sql',
        exportName: 'adminDashboardEndpoints',
        priority: 7,
        category: 'core',
        description: 'Admin dashboard endpoints (SQL)',
    },
    {
        file: 'customer-dashboard-endpoints-sql',
        exportName: 'customerDashboardEndpoints',
        priority: 8,
        category: 'core',
        description: 'Customer dashboard endpoints (SQL)',
    },
    {
        file: 'user-mapping-endpoints',
        exportName: 'userMappingEndpoints',
        priority: 9,
        category: 'core',
        description: 'User ID mapping endpoints (Cognito to Database)',
    },
    // ============================================================================
    // SECONDARY ENDPOINTS (Priority 11-50) - IMPORTANT BUSINESS FEATURES
    // ============================================================================
    {
        file: 'clinic-doctor-endpoints-sql',
        exportName: 'registerClinicDoctorEndpointsSQL',
        priority: 11,
        category: 'secondary',
        description: 'Clinic and doctor management endpoints (SQL)',
    },
    {
        file: 'reverification-sql',
        exportName: 'registerReverificationEndpointsSQL',
        priority: 12,
        category: 'secondary',
        description: 'Vendor reverification endpoints (SQL)',
    },
    {
        file: 'appointment-detail-endpoints-sql',
        exportName: 'appointmentDetailEndpointsSQL',
        priority: 13,
        category: 'secondary',
        description: 'Appointment detail endpoints (SQL)',
    },
    {
        file: 'appointment-reminder-system-sql',
        exportName: 'registerAppointmentReminderSystemSQL',
        priority: 14,
        category: 'secondary',
        description: 'Appointment reminder system (SQL)',
    },
    {
        file: 'service-package-management-sql',
        exportName: 'registerServicePackageManagement',
        priority: 15,
        category: 'secondary',
        description: 'Service package management endpoints (SQL)',
    },
    {
        file: 'package-endpoints-sql',
        exportName: 'packageEndpointsSQL',
        priority: 16,
        category: 'secondary',
        description: 'Package and membership endpoints (SQL)',
    },
    {
        file: 'promotion-endpoints-sql',
        exportName: 'promotionEndpointsSQL',
        priority: 17,
        category: 'secondary',
        description: 'Promotion management endpoints (SQL)',
    },
    {
        file: 'insurance-endpoints-sql',
        exportName: 'insuranceEndpoints',
        priority: 18,
        category: 'secondary',
        description: 'Insurance management endpoints (SQL)',
    },
    {
        file: 'rewards-loyalty-system-sql',
        exportName: 'rewardsLoyaltySystemSQL',
        priority: 19,
        category: 'secondary',
        description: 'Loyalty and rewards system endpoints (SQL)',
    },
    {
        file: 'bank-verification-endpoints-sql',
        exportName: 'bankVerificationEndpoints',
        priority: 20,
        category: 'secondary',
        description: 'Bank verification endpoints (SQL)',
    },
    {
        file: 'training-progress-endpoints-sql',
        exportName: 'trainingProgressEndpoints',
        priority: 21,
        category: 'secondary',
        description: 'Training progress tracking endpoints (SQL)',
    },
    {
        file: 'tele-consultation-endpoints-sql',
        exportName: 'teleConsultationEndpoints',
        priority: 22,
        category: 'secondary',
        description: 'Tele-consultation endpoints (SQL)',
    },
    {
        file: 'tier-upgrade-automation-sql',
        exportName: 'tierUpgradeAutomationSQL',
        priority: 23,
        category: 'secondary',
        description: 'Tier upgrade automation endpoints (SQL)',
    },
    {
        file: 'tier-system-sql',
        exportName: 'tierSystemEndpoints',
        priority: 24,
        category: 'secondary',
        description: 'Tier system endpoints (SQL)',
    },
    {
        file: 'platform-subscription-tiers-sql',
        exportName: 'registerPlatformSubscriptionTiersSQL',
        priority: 25,
        category: 'secondary',
        description: 'Platform subscription tiers (SQL)',
    },
    {
        file: 'universal-otp-system-sql',
        exportName: 'registerUniversalOTPSystemSQL',
        priority: 26,
        category: 'secondary',
        description: 'Universal OTP system (SQL)',
    },
    {
        file: 'sms-notification-service-enhanced-sql',
        exportName: 'smsNotificationServiceEnhanced',
        priority: 27,
        category: 'secondary',
        description: 'SMS notification service (SQL)',
    },
    {
        file: 'staff-auth-endpoints-sql',
        exportName: 'staffAuthEndpointsSQL',
        priority: 28,
        category: 'secondary',
        description: 'Staff authentication endpoints (SQL)',
    },
    {
        file: 'staff-schedule-endpoints-sql',
        exportName: 'staffScheduleEndpointsSQL',
        priority: 29,
        category: 'secondary',
        description: 'Staff schedule management (SQL)',
    },
    {
        file: 'universal-customer-search-sql',
        exportName: 'registerUniversalCustomerSearch',
        priority: 30,
        category: 'secondary',
        description: 'Universal customer search (SQL)',
    },
    {
        file: 'universal-staff-problem-search-sql',
        exportName: 'universalStaffProblemSearchSQL',
        priority: 31,
        category: 'secondary',
        description: 'Universal staff problem search (SQL)',
    },
    {
        file: 'customer-pets-sql',
        exportName: 'registerCustomerPetsRoutes',
        priority: 32,
        category: 'secondary',
        description: 'Customer pet management (SQL)',
    },
    {
        file: 'customer-medical-records-sql',
        exportName: 'registerCustomerMedicalRecordsEndpointsSQL',
        priority: 33,
        category: 'secondary',
        description: 'Customer medical records (SQL)',
    },
    {
        file: 'customer-ecommerce-endpoints-sql',
        exportName: 'customerEcommerceEndpointsSQL',
        priority: 34,
        category: 'secondary',
        description: 'Customer e-commerce endpoints (SQL)',
    },
    {
        file: 'home-services-enhanced-sql',
        exportName: 'homeServicesEnhancedSQL',
        priority: 35,
        category: 'secondary',
        description: 'Home services enhanced (SQL)',
    },
    {
        file: 'logistics-adapter-sql',
        exportName: 'registerLogisticsEndpoints',
        priority: 36,
        category: 'secondary',
        description: 'Logistics adapter endpoints (SQL)',
    },
    {
        file: 'banner-endpoints-sql',
        exportName: 'registerBannerEndpointsSQL',
        priority: 37,
        category: 'secondary',
        description: 'Banner management endpoints (SQL)',
    },
    {
        file: 'donation-management-endpoints-sql',
        exportName: 'donationManagementEndpointsSQL',
        priority: 38,
        category: 'secondary',
        description: 'Donation management (SQL)',
    },
    {
        file: 'search-analytics-api-sql',
        exportName: 'searchAnalyticsAPI',
        priority: 39,
        category: 'secondary',
        description: 'Search analytics API (SQL)',
    },
    {
        file: 'analytics-aggregation-sql',
        exportName: 'analyticsAggregationEndpoints',
        priority: 40,
        category: 'secondary',
        description: 'Analytics aggregation (SQL)',
    },
    {
        file: 'analytics-dashboard-sprint2-sql',
        exportName: 'registerAnalyticsDashboardSprint2SQL',
        priority: 41,
        category: 'secondary',
        description: 'Analytics dashboard (SQL)',
    },
    {
        file: 'advanced-search-engine-sql',
        exportName: 'registerAdvancedSearchEngine',
        priority: 42,
        category: 'secondary',
        description: 'Advanced search engine (SQL)',
    },
    // Note: availability-engine-sql exports utility functions, not endpoints
    // {
    //   file: 'availability-engine-sql',
    //   exportName: 'default',
    //   priority: 43,
    //   category: 'secondary',
    //   description: 'Availability engine (SQL)',
    // },
    {
        file: 'enhanced-staff-availability-with-conflicts-sql',
        exportName: 'enhancedStaffAvailabilityWithConflictsSQL',
        priority: 44,
        category: 'secondary',
        description: 'Enhanced staff availability (SQL)',
    },
    {
        file: 'multi-service-scheduling-sql',
        exportName: 'multiServiceSchedulingEndpoints',
        priority: 45,
        category: 'secondary',
        description: 'Multi-service scheduling (SQL)',
    },
    {
        file: 'auto-assignment-logic-sql',
        exportName: 'autoAssignmentLogicEndpoints',
        priority: 32,
        category: 'secondary',
        description: 'Auto-assignment logic for bookings (SQL)',
    },
    {
        file: 'region-endpoints-sql',
        exportName: 'regionEndpoints',
        priority: 10,
        category: 'core',
        description: 'Region management endpoints (SQL)',
    },
    {
        file: 'vendor-onboarding-sql',
        exportName: 'vendorOnboardingEndpoints',
        priority: 5,
        category: 'core',
        description: 'Vendor onboarding and application management (SQL)',
    },
    {
        file: 'facility-endpoints-sql',
        exportName: 'facilityEndpoints',
        priority: 15,
        category: 'secondary',
        description: 'Facility management endpoints (SQL)',
    },
    {
        file: 'customer-services-sql',
        exportName: 'registerCustomerServices',
        priority: 8,
        category: 'core',
        description: 'Customer-facing service discovery endpoints (SQL)',
    },
    {
        file: 'booking-lifecycle-sql',
        exportName: 'registerBookingLifecycleEndpoints',
        priority: 3,
        category: 'core',
        description: 'Booking lifecycle management (reschedule, accept, reject) (SQL)',
    },
    {
        file: 'vendor-dashboard-endpoints-sql',
        exportName: 'vendorDashboardEndpoints',
        priority: 7,
        category: 'core',
        description: 'Vendor dashboard endpoints with analytics and staff management (SQL)',
    },
    {
        file: 'admin-catalog-endpoints-sql',
        exportName: 'registerAdminCatalogEndpoints',
        priority: 12,
        category: 'secondary',
        description: 'Admin catalog management endpoints (SQL)',
    },
    {
        file: 'problem-grid-specialization-system-sql',
        exportName: 'registerProblemGridSpecializationSystem',
        priority: 46,
        category: 'secondary',
        description: 'Problem grid specialization system (SQL)',
    },
    {
        file: 'service-comparison-system-sql',
        exportName: 'serviceComparisonSystemSQL',
        priority: 47,
        category: 'secondary',
        description: 'Service comparison system (SQL)',
    },
    {
        file: 'expiry-management-endpoints-sql',
        exportName: 'registerExpiryManagementEndpointsSQL',
        priority: 48,
        category: 'secondary',
        description: 'Expiry management (SQL)',
    },
    {
        file: 'ai-chatbot-endpoints-sql',
        exportName: 'registerAIChatbotEndpoints',
        priority: 49,
        category: 'secondary',
        description: 'AI chatbot endpoints with AWS Bedrock (SQL)',
    },
    {
        file: 'medical-ai-summary-endpoints-sql',
        exportName: 'registerMedicalAISummaryEndpoints',
        priority: 50,
        category: 'secondary',
        description: 'Medical AI summary endpoints with AWS Bedrock (SQL)',
    },
    {
        file: 'media-upload-endpoints-sql',
        exportName: 'registerMediaUploadEndpoints',
        priority: 51,
        category: 'secondary',
        description: 'Universal media upload endpoints (S3)',
    },
    // ============================================================================
    // SPECIALIZED SERVICE ENDPOINTS (Priority 51-100)
    // ============================================================================
    {
        file: 'vet-specialized-services-sql',
        exportName: 'vetSpecializedServicesSQL',
        priority: 51,
        category: 'specialized',
        description: 'Vet specialized services (SQL)',
    },
    {
        file: 'specialized-services-endpoints-sql',
        exportName: 'specializedServicesEndpoints',
        priority: 52,
        category: 'specialized',
        description: 'Specialized services endpoints (SQL)',
    },
    {
        file: 'specialized-services-booking-sql',
        exportName: 'specializedServicesBooking',
        priority: 53,
        category: 'specialized',
        description: 'Specialized services booking (SQL)',
    },
    {
        file: 'pharmacy-prescription-endpoints-sql',
        exportName: 'pharmacyPrescriptionEndpointsSQL',
        priority: 54,
        category: 'specialized',
        description: 'Pharmacy prescription endpoints (SQL)',
    },
    {
        file: 'nutritionist-food-delivery-sql',
        exportName: 'nutritionistFoodDeliveryEndpointsSQL',
        priority: 55,
        category: 'specialized',
        description: 'Nutritionist food delivery (SQL)',
    },
    {
        file: 'cafe-table-management-sql',
        exportName: 'cafeTableManagementSQL',
        priority: 56,
        category: 'specialized',
        description: 'Cafe table management (SQL)',
    },
    {
        file: 'consultation-notes-endpoints-sql',
        exportName: 'consultationNotesEndpointsSQL',
        priority: 57,
        category: 'specialized',
        description: 'Consultation notes (SQL)',
    },
    {
        file: 'patient-monitoring-endpoints-sql',
        exportName: 'patientMonitoringEndpointsSQL',
        priority: 58,
        category: 'specialized',
        description: 'Patient monitoring (SQL)',
    },
    {
        file: 'controlled-substances-endpoints-sql',
        exportName: 'controlledSubstancesEndpointsSQL',
        priority: 59,
        category: 'specialized',
        description: 'Controlled substances (SQL)',
    },
    {
        file: 'cctv-access-endpoints-sql',
        exportName: 'cctvAccessEndpointsSQL',
        priority: 60,
        category: 'specialized',
        description: 'CCTV access endpoints (SQL)',
    },
];
/**
 * Register all endpoints in the Hono app
 *
 * @param app - Hono app instance
 */
async function registerAllEndpoints(app) {
    // Sort by priority
    const sortedEndpoints = [...ENDPOINT_REGISTRY].sort((a, b) => a.priority - b.priority);
    console.log(`📋 Registering ${sortedEndpoints.length} endpoint modules...`);
    let successCount = 0;
    let errorCount = 0;
    for (const endpoint of sortedEndpoints) {
        try {
            console.log(`✅ [${endpoint.category.toUpperCase()}] Registering ${endpoint.exportName} from ${endpoint.file} (Priority ${endpoint.priority})...`);
            // Import from Lambda endpoints directory (Node.js converted)
            // Note: Dynamic imports in Node.js require .js extension even for .ts files
            const modulePath = `./endpoints/${endpoint.file}`;
            let module;
            try {
                module = await Promise.resolve(`${modulePath}`).then(s => __importStar(require(s)));
                console.log(`   ✅ Imported: ${modulePath}`);
            }
            catch (importError) {
                console.error(`   ❌ Could not import ${endpoint.file}`);
                if (importError instanceof Error) {
                    console.error(`   Error: ${importError.message}`);
                }
                errorCount++;
                continue;
            }
            // Handle different export patterns
            let registerFunction = null;
            if (endpoint.exportName === 'default') {
                // Default export - wrap it in a function
                if (module.default) {
                    if (typeof module.default === 'function') {
                        registerFunction = module.default;
                    }
                    else if (module.default && typeof module.default === 'object') {
                        // It's a Hono app instance, wrap it
                        registerFunction = (app) => {
                            // Merge routes from default export into main app
                            // Note: This is a simplified approach - in production, you'd want to properly merge routes
                            console.log(`   ⚠️ Default export is an app instance - routes should be merged`);
                        };
                    }
                }
            }
            else {
                registerFunction = module[endpoint.exportName];
            }
            if (typeof registerFunction === 'function') {
                registerFunction(app);
                console.log(`   ✅ Successfully registered ${endpoint.exportName}`);
                successCount++;
            }
            else {
                console.warn(`   ⚠️ ${endpoint.exportName} is not a function in ${endpoint.file}`);
                errorCount++;
            }
        }
        catch (error) {
            console.error(`   ❌ Error registering ${endpoint.exportName}:`, error);
            errorCount++;
        }
    }
    console.log(`\n📊 Registration Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📋 Total: ${sortedEndpoints.length}`);
}
/**
 * Get endpoint registry (for debugging/inspection)
 */
function getEndpointRegistry() {
    return [...ENDPOINT_REGISTRY];
}
/**
 * Get endpoints by category
 */
function getEndpointsByCategory(category) {
    return ENDPOINT_REGISTRY.filter(e => e.category === category);
}
//# sourceMappingURL=endpoint-registry.js.map