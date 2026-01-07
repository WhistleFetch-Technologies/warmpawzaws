// ============================================================================
// VENDOR ONBOARDING ROUTE MAP
// ============================================================================
// Maps onboarding_status to frontend routes
// All routes are recoverable on refresh
// ============================================================================

export type OnboardingStatus =
  | 'INIT'
  | 'ROLE_PENDING'
  | 'FORM_PENDING'
  | 'UNDER_REVIEW'
  | 'CLARIFICATION_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVATED';

export interface RouteConfig {
  path: string;
  component: string;
  requiresAuth: boolean;
  allowedStatuses: OnboardingStatus[];
  redirectIfNotAllowed?: string;
}

export const ONBOARDING_ROUTES: Record<string, RouteConfig> = {
  // Phase 1: Auth
  '/auth/otp': {
    path: '/auth/otp',
    component: 'VendorAuth',
    requiresAuth: false,
    allowedStatuses: ['INIT', 'ROLE_PENDING', 'FORM_PENDING', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED', 'APPROVED', 'REJECTED', 'ACTIVATED'],
  },

  // Phase 2: Role Selection
  '/onboarding/role-selection': {
    path: '/onboarding/role-selection',
    component: 'RoleSelection',
    requiresAuth: true,
    allowedStatuses: ['INIT', 'ROLE_PENDING', 'REJECTED'],
    redirectIfNotAllowed: '/onboarding/status',
  },

  // Phase 3: Vendor Type
  '/onboarding/vendor-type': {
    path: '/onboarding/vendor-type',
    component: 'VendorTypeSelection',
    requiresAuth: true,
    allowedStatuses: ['ROLE_PENDING'],
    redirectIfNotAllowed: '/onboarding/role-selection',
  },

  // Phase 4: Dynamic Form
  '/onboarding/form': {
    path: '/onboarding/form',
    component: 'OnboardingForm',
    requiresAuth: true,
    allowedStatuses: ['FORM_PENDING', 'CLARIFICATION_REQUIRED'],
    redirectIfNotAllowed: '/onboarding/status',
  },

  // Phase 5: Pending Review
  '/onboarding/pending-review': {
    path: '/onboarding/pending-review',
    component: 'PendingReview',
    requiresAuth: true,
    allowedStatuses: ['UNDER_REVIEW'],
    redirectIfNotAllowed: '/onboarding/status',
  },

  // Phase 6: Clarification Required
  '/onboarding/clarification': {
    path: '/onboarding/clarification',
    component: 'ClarificationRequired',
    requiresAuth: true,
    allowedStatuses: ['CLARIFICATION_REQUIRED'],
    redirectIfNotAllowed: '/onboarding/status',
  },

  // Phase 7: Approved
  '/onboarding/approved': {
    path: '/onboarding/approved',
    component: 'Approved',
    requiresAuth: true,
    allowedStatuses: ['APPROVED'],
    redirectIfNotAllowed: '/onboarding/status',
  },

  // Phase 7: Rejected
  '/onboarding/rejected': {
    path: '/onboarding/rejected',
    component: 'Rejected',
    requiresAuth: true,
    allowedStatuses: ['REJECTED'],
    redirectIfNotAllowed: '/onboarding/status',
  },

  // Phase 8: Dashboard (Post-Activation)
  '/dashboard': {
    path: '/dashboard',
    component: 'VendorDashboard',
    requiresAuth: true,
    allowedStatuses: ['ACTIVATED'],
    redirectIfNotAllowed: '/onboarding/status',
  },
};

/**
 * Get route for onboarding status
 */
export function getRouteForStatus(status: OnboardingStatus): string {
  const routeMap: Record<OnboardingStatus, string> = {
    INIT: '/onboarding/role-selection',
    ROLE_PENDING: '/onboarding/vendor-type',
    FORM_PENDING: '/onboarding/form',
    UNDER_REVIEW: '/onboarding/pending-review',
    CLARIFICATION_REQUIRED: '/onboarding/clarification',
    APPROVED: '/onboarding/approved',
    REJECTED: '/onboarding/rejected',
    ACTIVATED: '/dashboard',
  };

  return routeMap[status] || '/onboarding/role-selection';
}

/**
 * Check if route is allowed for current status
 */
export function isRouteAllowed(route: string, status: OnboardingStatus): boolean {
  const routeConfig = ONBOARDING_ROUTES[route];
  if (!routeConfig) return false;
  return routeConfig.allowedStatuses.includes(status);
}

/**
 * Get redirect route if current route is not allowed
 */
export function getRedirectRoute(route: string, status: OnboardingStatus): string {
  const routeConfig = ONBOARDING_ROUTES[route];
  if (!routeConfig) return '/onboarding/status';
  
  if (!isRouteAllowed(route, status)) {
    return routeConfig.redirectIfNotAllowed || getRouteForStatus(status);
  }
  
  return route;
}

