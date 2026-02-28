/**
 * ============================================================================
 * ADMIN ROUTES
 * ============================================================================
 * 
 * Route registration for admin endpoints
 * 
 * Date: 2026-01-28
 * Phase 4: Admin domain restructuring
 * ============================================================================
 */

import { Hono } from 'hono';

// Import from original backend (to be extracted to controllers/admin/)
import { registerAdminEndpoints } from '../endpoints/admin';
import { registerAdminAdvancedEndpoints } from '../endpoints/admin-advanced';
import { registerAdminComprehensiveEndpoints } from '../endpoints/admin-comprehensive';
import { registerAdminGovernanceEndpoints } from '../endpoints/admin-governance';
import { registerAdminGovernanceEnhancedEndpoints } from '../endpoints/admin-governance-enhanced';
import { registerAdminCustomServicesEndpoints } from '../endpoints/admin-custom-services';
import { registerAdminIntegrationEndpoints } from '../endpoints/admin-integrations';
import { registerRoleEndpoints } from '../endpoints/roles';
import { registerRoleSeedingEndpoints } from '../endpoints/role-seeding';
import { registerOnboardingFormManagementEndpoints } from '../endpoints/onboarding-form-management';
import { registerRegionEndpoints } from '../endpoints/regions';
import { registerConfigPoliciesEndpoints } from '../endpoints/config-policies';
import { registerFeeConfigEndpoints } from '../endpoints/fee-config';
import { registerTaxManagementEndpoints } from '../endpoints/tax-management';
import { registerLogisticsManagementEndpoints } from '../endpoints/logistics-management';
import { registerPaymentGatewayManagementEndpoints } from '../endpoints/payment-gateway-management';
import { registerLoyaltyActionRulesManagementEndpoints } from '../endpoints/loyalty-action-rules-management';
import { registerLoyaltySegmentsManagementEndpoints } from '../endpoints/loyalty-segments-management';
import { registerUIDashboardConfigEndpoints } from '../endpoints/ui-dashboard-config';
import { registerServiceLaunchConfigEndpoints } from '../endpoints/service-launch-config';
import { registerSpecializationMasterEndpoints } from '../endpoints/specialization-master';
import { registerProblemGridEndpoints } from '../endpoints/problem-grid';
import { registerDiscoveryRulesAdminEndpoints } from '../endpoints/discovery-rules-admin';
import { registerSubscriptionPlansAdminEndpoints } from '../endpoints/subscription-plans-admin';

/**
 * Register all admin-related routes
 * Preserves exact route registration order from handler/index.ts
 */
export function registerAdminRoutes(app: Hono) {
  // Register role endpoints first
  registerRoleEndpoints(app);
  registerRoleSeedingEndpoints(app);
  registerOnboardingFormManagementEndpoints(app);
  
  // Register admin management endpoints
  registerAdminEndpoints(app);
  registerAdminAdvancedEndpoints(app);
  registerAdminComprehensiveEndpoints(app);
  registerAdminGovernanceEndpoints(app);
  registerAdminGovernanceEnhancedEndpoints(app);
  registerAdminCustomServicesEndpoints(app);
  registerAdminIntegrationEndpoints(app);
  
  // Register configuration endpoints
  registerRegionEndpoints(app);
  registerConfigPoliciesEndpoints(app);
  registerFeeConfigEndpoints(app);
  registerTaxManagementEndpoints(app);
  registerLogisticsManagementEndpoints(app);
  registerPaymentGatewayManagementEndpoints(app);
  registerLoyaltyActionRulesManagementEndpoints(app);
  registerLoyaltySegmentsManagementEndpoints(app);
  registerUIDashboardConfigEndpoints(app);
  registerServiceLaunchConfigEndpoints(app);
  registerSpecializationMasterEndpoints(app);
  registerProblemGridEndpoints(app);
  registerDiscoveryRulesAdminEndpoints(app);
  registerSubscriptionPlansAdminEndpoints(app);
}
