import { isWarmpawzAppointmentsHubEnabled } from '@/lib/warmpawz-appointments-customer';

export type HomeVisitWapptDiscoveryNav = {
  screen: 'wappt-discovery';
  category: string;
  serviceStyle: 'at_home';
  lockStyleFilter: true;
  profileBackScreen: 'home-service-selection';
};

const HOME_VISIT_TARGET_TO_WAPPT_CATEGORY: Record<string, string> = {
  'vet-home-visit': 'vet',
  grooming_home: 'grooming',
  training_home: 'training',
  walker: 'walker',
  'pet-sitter': 'sitting',
  pet_sitter: 'sitting',
  sitting: 'sitting',
};

export function resolveHomeVisitWapptCategory(targetScreen: string): string | null {
  const key = String(targetScreen || '').trim();
  if (!key) return null;
  return HOME_VISIT_TARGET_TO_WAPPT_CATEGORY[key] ?? null;
}

export function resolveHomeVisitVendorListNavigation(
  targetScreen: string,
  data?: Record<string, unknown> | null,
): HomeVisitWapptDiscoveryNav | null {
  if (data?.fromHomeVisitLanding !== true) return null;

  const category = resolveHomeVisitWapptCategory(targetScreen);
  if (!category) return null;
  if (!isWarmpawzAppointmentsHubEnabled(category)) return null;

  return {
    screen: 'wappt-discovery',
    category,
    serviceStyle: 'at_home',
    lockStyleFilter: true,
    profileBackScreen: 'home-service-selection',
  };
}
