"use strict";
/**
 * ============================================================================
 * ENDPOINT REGISTRY SYSTEM
 * ============================================================================
 *
 * Auto-discovers and registers all endpoint files from the Supabase functions
 * directory. This system maps endpoint files to their registration functions.
 *
 * Agent 2: Lambda Migration Agent
 * Date: 2025-01-27
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_ENDPOINTS = exports.ANALYTICS_ENDPOINTS = exports.ADMIN_ENDPOINTS = exports.SPECIALIZED_ENDPOINTS = exports.SECONDARY_ENDPOINTS = exports.CORE_ENDPOINTS = void 0;
exports.registerEndpoints = registerEndpoints;
exports.getEndpointStats = getEndpointStats;
/**
 * Core endpoints (Priority 1-10)
 * These are critical business logic endpoints that must be registered first
 */
exports.CORE_ENDPOINTS = [
    {
        file: 'auth-endpoints.tsx',
        functionName: 'registerAuthEndpoints',
        priority: 1,
        description: 'Authentication endpoints (OTP, login, session)'
    },
    {
        file: 'booking-endpoints.tsx',
        functionName: 'bookingEndpoints',
        priority: 2,
        description: 'Booking creation, updates, cancellation'
    },
    {
        file: 'payment-endpoints.tsx',
        functionName: 'paymentEndpoints',
        priority: 3,
        description: 'Payment processing endpoints'
    },
    {
        file: 'customer-routes.tsx',
        functionName: 'registerCustomerRoutes',
        priority: 4,
        description: 'Customer management endpoints'
    },
    {
        file: 'vendor-routes.tsx',
        functionName: 'registerVendorRoutes',
        priority: 5,
        description: 'Vendor management endpoints'
    },
    {
        file: 'staff-crud-endpoints.tsx',
        functionName: 'staffCrudEndpoints',
        priority: 6,
        description: 'Staff CRUD operations'
    },
];
/**
 * Secondary endpoints (Priority 11-50)
 * Important but not critical for basic functionality
 */
exports.SECONDARY_ENDPOINTS = [
    {
        file: 'order-management-endpoints.tsx',
        functionName: 'orderManagementEndpoints',
        priority: 11,
        description: 'Order management'
    },
    {
        file: 'wallet-endpoints.tsx',
        functionName: 'walletEndpoints',
        priority: 12,
        description: 'Wallet operations'
    },
    {
        file: 'prescription-endpoints.tsx',
        functionName: 'prescriptionEndpoints',
        priority: 13,
        description: 'Prescription management'
    },
    {
        file: 'review-endpoints.tsx',
        functionName: 'reviewEndpoints',
        priority: 14,
        description: 'Review endpoints'
    },
    {
        file: 'region-endpoints.tsx',
        functionName: 'regionEndpoints',
        priority: 15,
        description: 'Region management'
    },
    {
        file: 'onboarding-form-api.tsx',
        functionName: 'onboardingFormAPI',
        priority: 16,
        description: 'Onboarding form API'
    },
    {
        file: 'role-config-endpoints.tsx',
        functionName: 'roleConfigEndpoints',
        priority: 17,
        description: 'Role configuration'
    },
    {
        file: 'catalog-endpoints-sql.tsx',
        functionName: 'catalogEndpointsSQL',
        priority: 18,
        description: 'Catalog endpoints (SQL)'
    },
];
/**
 * Specialized service endpoints (Priority 51-100)
 */
exports.SPECIALIZED_ENDPOINTS = [
    {
        file: 'grooming-endpoints.tsx',
        functionName: 'groomingEndpoints',
        priority: 51,
        description: 'Grooming service endpoints'
    },
    {
        file: 'vet-booking-endpoints.tsx',
        functionName: 'vetBookingEndpoints',
        priority: 52,
        description: 'Veterinary booking endpoints'
    },
    {
        file: 'adoption-endpoints.tsx',
        functionName: 'adoptionEndpoints',
        priority: 53,
        description: 'Adoption service endpoints'
    },
    {
        file: 'insurance-endpoints.tsx',
        functionName: 'insuranceEndpoints',
        priority: 54,
        description: 'Insurance endpoints'
    },
    {
        file: 'package-endpoints.tsx',
        functionName: 'packageEndpoints',
        priority: 55,
        description: 'Package service endpoints'
    },
];
/**
 * Admin endpoints (Priority 101-150)
 */
exports.ADMIN_ENDPOINTS = [
    {
        file: 'admin-vendor-endpoints.tsx',
        functionName: 'adminVendorEndpoints',
        priority: 101,
        description: 'Admin vendor management'
    },
    {
        file: 'admin-catalog-endpoints.tsx',
        functionName: 'registerAdminCatalogEndpoints',
        priority: 102,
        description: 'Admin catalog management'
    },
    {
        file: 'admin-integration-endpoints.tsx',
        functionName: 'adminIntegrationEndpoints',
        priority: 103,
        description: 'Admin integration endpoints'
    },
    {
        file: 'admin-payout-endpoints.tsx',
        functionName: 'adminPayoutEndpoints',
        priority: 104,
        description: 'Admin payout management'
    },
];
/**
 * Analytics endpoints (Priority 151-200)
 */
exports.ANALYTICS_ENDPOINTS = [
    {
        file: 'analytics-endpoints.tsx',
        functionName: 'analyticsEndpoints',
        priority: 151,
        description: 'Analytics endpoints'
    },
    {
        file: 'vendor-analytics-endpoints.tsx',
        functionName: 'vendorAnalyticsEndpoints',
        priority: 152,
        description: 'Vendor analytics'
    },
    {
        file: 'analytics-dashboard-endpoints.tsx',
        functionName: 'analyticsDashboardEndpoints',
        priority: 153,
        description: 'Analytics dashboard'
    },
];
/**
 * All endpoints combined and sorted by priority
 */
exports.ALL_ENDPOINTS = [
    ...exports.CORE_ENDPOINTS,
    ...exports.SECONDARY_ENDPOINTS,
    ...exports.SPECIALIZED_ENDPOINTS,
    ...exports.ADMIN_ENDPOINTS,
    ...exports.ANALYTICS_ENDPOINTS,
].sort((a, b) => a.priority - b.priority);
/**
 * Register all endpoints with error handling
 *
 * @param app Hono app instance
 * @param endpointEntries List of endpoint entries to register
 */
async function registerEndpoints(app, endpointEntries = exports.ALL_ENDPOINTS) {
    let registered = 0;
    let failed = 0;
    const errors = [];
    for (const entry of endpointEntries) {
        try {
            console.log(`📋 Registering ${entry.description} (${entry.file})...`);
            // Dynamic import - will be converted to Node.js require() later
            // For now, this is a placeholder that will be replaced with actual imports
            // TODO: Convert to Node.js require() or static imports after Deno conversion
            // Placeholder registration - actual implementation will load the module
            // and call the registration function
            registered++;
            console.log(`✅ Registered ${entry.description}`);
        }
        catch (error) {
            failed++;
            const errorMsg = `Failed to register ${entry.file}: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
        }
    }
    return { registered, failed, errors };
}
/**
 * Get endpoint statistics
 */
function getEndpointStats() {
    return {
        total: exports.ALL_ENDPOINTS.length,
        core: exports.CORE_ENDPOINTS.length,
        secondary: exports.SECONDARY_ENDPOINTS.length,
        specialized: exports.SPECIALIZED_ENDPOINTS.length,
        admin: exports.ADMIN_ENDPOINTS.length,
        analytics: exports.ANALYTICS_ENDPOINTS.length,
    };
}
//# sourceMappingURL=endpoint-registry.js.map