import type { RoleId } from '@/components/customer/shared/roleConfig';
import { isWarmpawzAppointmentsHubEnabled } from '@/lib/warmpawz-appointments-customer';

export type WapptHubCategory =
  | 'vet'
  | 'grooming'
  | 'training'
  | 'behaviorist'
  | 'walker'
  | 'boarding'
  | 'sitting'
  | 'nutrition';

export type WapptDiscoveryStyle = 'at_center' | 'at_home';

export type WapptHubConfig = {
  wapptCategory: WapptHubCategory;
  roleId: RoleId;
  bookingScreen: string;
  defaultServiceStyle: 'at_center' | 'at_home' | 'tele';
  /** Styles shown on WAPPT discovery list toggles */
  allowedDiscoveryStyles: WapptDiscoveryStyle[];
  defaultDiscoveryStyle: WapptDiscoveryStyle;
  wapptTileId: string;
  tileImage?: string;
};

const WAPPT_HUB_REGISTRY: Record<WapptHubCategory, WapptHubConfig> = {
  vet: {
    wapptCategory: 'vet',
    roleId: 'veterinarian',
    bookingScreen: 'vet-booking',
    defaultServiceStyle: 'at_center',
    allowedDiscoveryStyles: ['at_center', 'at_home'],
    defaultDiscoveryStyle: 'at_center',
    wapptTileId: 'wappt_vet',
    tileImage: '/images/home/Vet/clinic-visit.webp',
  },
  grooming: {
    wapptCategory: 'grooming',
    roleId: 'groomer',
    bookingScreen: 'grooming-booking',
    defaultServiceStyle: 'at_center',
    allowedDiscoveryStyles: ['at_center', 'at_home'],
    defaultDiscoveryStyle: 'at_center',
    wapptTileId: 'wappt_grooming',
    tileImage: '/images/home/Grooming/grooming-center.webp',
  },
  training: {
    wapptCategory: 'training',
    roleId: 'trainer',
    bookingScreen: 'training-booking',
    defaultServiceStyle: 'at_center',
    allowedDiscoveryStyles: ['at_center', 'at_home'],
    defaultDiscoveryStyle: 'at_center',
    wapptTileId: 'wappt_training',
    tileImage: '/images/home/Training/training-center.webp',
  },
  behaviorist: {
    wapptCategory: 'behaviorist',
    roleId: 'behaviorist',
    bookingScreen: 'training-booking',
    defaultServiceStyle: 'at_home',
    allowedDiscoveryStyles: ['at_center', 'at_home'],
    defaultDiscoveryStyle: 'at_home',
    wapptTileId: 'wappt_behaviorist',
    tileImage: '/images/home/Training/separation-anxiety.webp',
  },
  walker: {
    wapptCategory: 'walker',
    roleId: 'walker',
    bookingScreen: 'walker-booking',
    defaultServiceStyle: 'at_home',
    allowedDiscoveryStyles: ['at_center', 'at_home'],
    defaultDiscoveryStyle: 'at_home',
    wapptTileId: 'wappt_walker',
    tileImage: '/images/home/Walking/walking-banner.webp',
  },
  boarding: {
    wapptCategory: 'boarding',
    roleId: 'boarding',
    bookingScreen: 'boarding-booking',
    defaultServiceStyle: 'at_center',
    allowedDiscoveryStyles: ['at_center', 'at_home'],
    defaultDiscoveryStyle: 'at_center',
    wapptTileId: 'wappt_boarding',
    tileImage: '/images/home/Boarding/overnight.webp',
  },
  sitting: {
    wapptCategory: 'sitting',
    roleId: 'pet_sitter',
    bookingScreen: 'pet-sitter-booking',
    defaultServiceStyle: 'at_home',
    allowedDiscoveryStyles: ['at_center', 'at_home'],
    defaultDiscoveryStyle: 'at_home',
    wapptTileId: 'wappt_sitting',
    tileImage: '/images/home/Sitting/day-sitting.webp',
  },
  nutrition: {
    wapptCategory: 'nutrition',
    roleId: 'nutritionist',
    bookingScreen: 'nutritionist-booking',
    defaultServiceStyle: 'at_center',
    allowedDiscoveryStyles: ['at_center', 'at_home'],
    defaultDiscoveryStyle: 'at_center',
    wapptTileId: 'wappt_nutrition',
    tileImage: '/images/home/Nutrition/diet-consultation.webp',
  },
};

const CATEGORY_ALIASES: Record<string, WapptHubCategory> = {
  vet: 'vet',
  veterinarian: 'vet',
  vet_clinic: 'vet',
  grooming: 'grooming',
  groomer: 'grooming',
  pet_groomer: 'grooming',
  training: 'training',
  trainer: 'training',
  pet_trainer: 'training',
  behaviorist: 'behaviorist',
  behaviourist: 'behaviorist',
  pet_behaviorist: 'behaviorist',
  'pet-behaviorist': 'behaviorist',
  walker: 'walker',
  walking: 'walker',
  dog_walker: 'walker',
  pet_walker: 'walker',
  boarding: 'boarding',
  pet_boarding: 'boarding',
  sitting: 'sitting',
  sitter: 'sitting',
  pet_sitter: 'sitting',
  'pet-sitter': 'sitting',
  nutrition: 'nutrition',
  nutritionist: 'nutrition',
  pet_nutritionist: 'nutrition',
};

/** Normalize shell/API category tokens to a WAPPT hub category id. */
export function normalizeWapptHubCategory(category: string): WapptHubCategory | null {
  const token = String(category ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return CATEGORY_ALIASES[token] ?? null;
}

export function getWapptHubConfig(category: string): WapptHubConfig | null {
  const hub = normalizeWapptHubCategory(category);
  if (!hub) return null;
  return WAPPT_HUB_REGISTRY[hub];
}

export function isKnownWapptHubCategory(category: string): boolean {
  return normalizeWapptHubCategory(category) != null;
}

export type WapptHubServiceTile = {
  id: string;
  name: string;
  description: string;
  image?: string;
  badge: string;
  badgeClass: string;
  trustedBy: string;
  arrowClass: string;
};

export function buildWapptHubTile(category: string): WapptHubServiceTile | null {
  const config = getWapptHubConfig(category);
  if (!config) return null;
  return {
    id: config.wapptTileId,
    name: 'Book Appointment',
    description: 'Fixed fee · pick a slot',
    image: config.tileImage,
    badge: 'WARMPAWZ',
    badgeClass: 'bg-[#FF8C42] text-white',
    trustedBy: 'Admin-curated providers',
    arrowClass: 'bg-[#FF8C42] hover:bg-orange-600',
  };
}

export function mergeWapptServiceTypes<T extends { id: string }>(
  marketplaceTiles: T[],
  category: string,
): T[] {
  const wapptTile = buildWapptHubTile(category);
  if (!wapptTile || !isWarmpawzAppointmentsHubEnabled(category)) {
    return marketplaceTiles;
  }
  return [wapptTile as unknown as T, ...marketplaceTiles];
}

export function getWapptDiscoveryCategory(category: string): string {
  return normalizeWapptHubCategory(category) ?? category;
}

export function listWapptHubCategories(): WapptHubCategory[] {
  return Object.keys(WAPPT_HUB_REGISTRY) as WapptHubCategory[];
}

export function getWapptAllowedDiscoveryStyles(category: string): WapptDiscoveryStyle[] {
  const config = getWapptHubConfig(category);
  return config?.allowedDiscoveryStyles ?? ['at_center', 'at_home'];
}

export function getWapptDefaultDiscoveryStyle(category: string): WapptDiscoveryStyle {
  const config = getWapptHubConfig(category);
  return config?.defaultDiscoveryStyle ?? 'at_center';
}

/** True when vendor is enrolled in Warmpawz Appointments flat-fee flow */
export function isWapptVendor(row: Record<string, unknown> | null | undefined): boolean {
  if (!row) return false;
  return row.warmpawzAppointments === true || row.appointmentsMode === true;
}
