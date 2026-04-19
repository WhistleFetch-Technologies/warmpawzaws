/**
 * Discovery + vendor-services API config for service hubs (grooming, training, vet, sitting).
 * Aligns hub “featured” lists with View All / discover-services.
 */

export type HubPhoneQueryParam = 'customerPhone' | 'phone';

export interface HubVendorDiscoveryConfig {
  /** GET /customer/vendor/:id/services?category= */
  servicesApiCategory: string;
  serviceStyle: 'at_center' | 'at_home' | 'tele';
  /** Standard discover-services (ignored if customLoadRows is set). */
  discoverCategory: string;
  /** Optional &roleId= on discover */
  discoverRoleId?: string;
  /** Fallback: /customer/services/by-style */
  fallbackByStyle?: { style: string; category: string; roleId?: string };
  /** Fallback: /customer/vendors/search */
  fallbackVendorSearch?: { roleId: string; limit?: number };
  phoneQueryParam?: HubPhoneQueryParam;
}

export const HUB_DISCOVERY_GROOMING: HubVendorDiscoveryConfig = {
  servicesApiCategory: 'grooming',
  serviceStyle: 'at_center',
  discoverCategory: 'grooming',
  fallbackByStyle: { style: 'at_center', category: 'grooming' },
  fallbackVendorSearch: { roleId: 'pet_groomer', limit: 50 },
};

export const HUB_DISCOVERY_TRAINING: HubVendorDiscoveryConfig = {
  servicesApiCategory: 'training',
  serviceStyle: 'at_center',
  discoverCategory: 'training',
  fallbackByStyle: { style: 'at_home', category: 'training' },
  fallbackVendorSearch: { roleId: 'pet_trainer', limit: 50 },
};

export const HUB_DISCOVERY_VET: HubVendorDiscoveryConfig = {
  servicesApiCategory: 'vet',
  serviceStyle: 'at_center',
  discoverCategory: 'vet',
  fallbackByStyle: { style: 'tele', category: 'vet' },
  fallbackVendorSearch: { roleId: 'veterinarian', limit: 50 },
};

/** Pet sitting — matches PetSitterServiceRouter discover URL. */
export const HUB_DISCOVERY_SITTING: HubVendorDiscoveryConfig = {
  servicesApiCategory: 'sitting',
  serviceStyle: 'at_home',
  discoverCategory: 'sitting',
  discoverRoleId: 'pet_sitter',
  phoneQueryParam: 'phone',
};
