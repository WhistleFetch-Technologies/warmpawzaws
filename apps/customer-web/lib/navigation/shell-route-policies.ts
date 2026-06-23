/**
 * Shell forward policies — registry decides; ShellNavigationService executes.
 *
 * - focus-root: tab/hub re-entry — truncate to existing hub (popToIfExists)
 * - push: entity drill-down — always append (requires key when entity-scoped)
 * - replace: swap top — success surfaces, auto-forward overlays
 * - reset: clear stack to single entry
 */
export type ShellForwardPolicy = 'focus-root' | 'push' | 'replace' | 'reset';

export type ShellRoutePolicyDef = {
  forward: ShellForwardPolicy;
  /** When true, forward() warns in dev if no key provided. */
  requiresKey?: boolean;
};

/** Tab / service hub screens — re-entering focuses existing entry, never duplicates. */
const HUB_SCREENS = new Set<string>([
  'home',
  'vet',
  'grooming',
  'grooming_center',
  'grooming_home',
  'training',
  'training_center',
  'training_home',
  'boarding',
  'boarding_facility',
  'pet-boarding-vendors',
  'pet-sitter',
  'pet-sitter-vendors',
  'walker',
  'my-bookings',
  'appointments',
  'nutritionist',
  'pharmacy',
  'lab-diagnostics',
  'behaviorist',
  'adoption',
  'sunset',
  'insurance',
  'cafes',
  'shop',
  'services',
  'problem_grid',
  'problem_grid_flow',
  'integrated-services',
  'home-service-selection',
  'mating-dating-hub',
  'photography',
  'breeder',
  'ambulance',
  'relocation',
  'resort',
  'holiday',
  'food',
  'wallet',
  'support_help',
  'pets',
  'nutrition-meal-plans',
  'diet-consultation-services',
  'vet-tele-consultation',
  'vet-home-visit',
  'vet-clinic-list',
  'vet-services-by-style',
]);

/** Entity / detail screens — always push (use routeKey.* for dedup of same entity). */
const ENTITY_SCREENS: Record<string, ShellRoutePolicyDef> = {
  'vet-clinic-profile': { forward: 'push', requiresKey: true },
  'vet-doctor-details': { forward: 'push', requiresKey: true },
  'vet-booking': { forward: 'push' },
  'vet-clinic-booking': { forward: 'push' },
  'grooming-booking': { forward: 'push' },
  'training-booking': { forward: 'push' },
  'boarding-booking': { forward: 'push' },
  'pet-sitter-booking': { forward: 'push' },
  'walker-booking': { forward: 'push' },
  'walker-provider-profile': { forward: 'push', requiresKey: true },
  'behaviorist-provider-profile': { forward: 'push', requiresKey: true },
  'pet-boarding-profile': { forward: 'push', requiresKey: true },
  'pet-sitter-provider-profile': { forward: 'push', requiresKey: true },
  'pet-details': { forward: 'push', requiresKey: true },
  'pet-profile': { forward: 'push', requiresKey: true },
  'pet-profile-dashboard': { forward: 'push' },
  'pet-quick': { forward: 'push' },
  'booking-details': { forward: 'push', requiresKey: true },
  'appointment-details': { forward: 'push', requiresKey: true },
  'product_detail': { forward: 'push', requiresKey: true },
  'product_reviews': { forward: 'push' },
  'vendor_profile': { forward: 'push', requiresKey: true },
  'order_detail': { forward: 'push', requiresKey: true },
  'order_tracking': { forward: 'push', requiresKey: true },
  'diagnostics-booking': { forward: 'push' },
  'diagnostics-reports': { forward: 'push', requiresKey: true },
  'sample-collection-tracking': { forward: 'push', requiresKey: true },
  'meal-order-checkout': { forward: 'push' },
  'meal-order-tracking': { forward: 'push', requiresKey: true },
  'nutritionist-booking': { forward: 'push' },
  'expert-nutritionists': { forward: 'push' },
  'nutritionist-tele': { forward: 'push' },
  'create-booking': { forward: 'push' },
  'universal-home-booking': { forward: 'push' },
  'cafe_detail': { forward: 'push', requiresKey: true },
  'insurance_provider': { forward: 'push', requiresKey: true },
  'resort_booking': { forward: 'push' },
  'services_by_problem': { forward: 'push' },
  'customer-profile': { forward: 'push' },
  'user-profile': { forward: 'push' },
  'profile': { forward: 'push' },
  'address_book': { forward: 'push' },
  'rewards-loyalty': { forward: 'push' },
  'referral-system': { forward: 'push' },
  'add-address': { forward: 'push' },
  'add-pet': { forward: 'push' },
  'checkout': { forward: 'push' },
  'cart': { forward: 'push' },
  'pharmacy_store': { forward: 'push' },
  'pharmacy_checkout': { forward: 'push' },
  'pharmacy_order_flow': { forward: 'push' },
  'pharmacy_order_status': { forward: 'push', requiresKey: true },
  'gps-tracking': { forward: 'push', requiresKey: true },
  'video-call': { forward: 'push', requiresKey: true },
  'walk-live-tracking': { forward: 'push', requiresKey: true },
  'schedule-walk': { forward: 'push' },
};

/** Top swap — auto-forward overlays and post-success landing (not Razorpay open timing). */
const REPLACE_SCREENS = new Set<string>([
  'purchase-package',
  'package-booking',
  'order_success',
  'instant-connecting',
  'payment',
  'return-request',
  'multi-pet-booking',
  'emergency-booking',
  'check-in-out',
  'medical-records',
  'package-tracking',
  'meal-plan-orders',
  'order_history',
  'coming-soon',
  'adoption_questionnaire',
  'bookings',
  'category-mapper',
  'problem_selected',
  'breeder_catalog',
  'ambulance_sos',
  'ambulance_schedule',
  'ambulance_transfer',
  'cafe_reservation',
]);

const RESET_SCREENS = new Set<string>(['home']);

const explicitPolicies: Record<string, ShellRoutePolicyDef> = {
  home: { forward: 'reset' },
  ...ENTITY_SCREENS,
};

function hubPolicy(): ShellRoutePolicyDef {
  return { forward: 'focus-root' };
}

function replacePolicy(): ShellRoutePolicyDef {
  return { forward: 'replace' };
}

/** Resolve forward policy for a shell screen id. */
export function getShellForwardPolicy(screen: string): ShellRoutePolicyDef {
  if (explicitPolicies[screen]) {
    return explicitPolicies[screen];
  }
  if (RESET_SCREENS.has(screen)) {
    return { forward: 'reset' };
  }
  if (REPLACE_SCREENS.has(screen)) {
    return replacePolicy();
  }
  if (HUB_SCREENS.has(screen)) {
    return hubPolicy();
  }
  /** Safe default during migration — matches legacy navigateToScreen push. */
  return { forward: 'push' };
}

/** All registered shell screen ids with policies (for dev validation). */
export function listRegisteredShellScreens(): string[] {
  const ids = new Set<string>([
    ...Object.keys(explicitPolicies),
    ...RESET_SCREENS,
    ...REPLACE_SCREENS,
    ...HUB_SCREENS,
  ]);
  return [...ids].sort();
}
