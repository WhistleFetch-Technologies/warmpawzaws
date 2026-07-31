import type { LucideIcon } from 'lucide-react';
import {
  Apple,
  Brain,
  Building2,
  Footprints,
  GraduationCap,
  Home,
  Scissors,
  Stethoscope,
  Video,
} from 'lucide-react';
import {
  HUB_DISCOVERY_GROOMING,
  HUB_DISCOVERY_SITTING,
  HUB_DISCOVERY_TRAINING,
  HUB_DISCOVERY_VET,
} from '@/lib/service-hub-discovery-config';
import {
  listWapptHubCategories,
  normalizeWapptHubCategory,
  type WapptHubCategory,
} from '@/lib/wappt-hub-registry';

export type WapptVendorProfileCategory = WapptHubCategory | string;

export type WapptVendorProfileConfig = {
  category: string;
  servicesApiCategory: string;
  sharePersona: string;
  headerIcon: LucideIcon;
  aboutFallback: (name: string) => string;
  servicesSearchPlaceholder: string;
  styleSubtitle: (serviceStyle: string) => string;
  styleBadgeLabel: (serviceStyle: string) => string;
};

const STYLE_SUBTITLE: Record<string, string> = {
  at_center: 'Visit our centre',
  at_home: 'Professional care at your home',
  tele: 'Video consultation available',
};

const STYLE_BADGE: Record<string, string> = {
  at_center: 'Centre Visit',
  at_home: 'Home Visit',
  tele: 'Tele Consultation',
};

const CATEGORY_CONFIG: Record<WapptHubCategory, WapptVendorProfileConfig> = {
  vet: {
    category: 'vet',
    servicesApiCategory: HUB_DISCOVERY_VET.servicesApiCategory,
    sharePersona: 'vet',
    headerIcon: Stethoscope,
    aboutFallback: (name) => `${name} provides professional veterinary services.`,
    servicesSearchPlaceholder: 'Search services...',
    styleSubtitle: (style) =>
      style === 'at_center'
        ? 'Visit our veterinary clinics'
        : style === 'at_home'
          ? 'Vet comes to you'
          : style === 'tele'
            ? 'Video consultation with vet'
            : STYLE_SUBTITLE[style] ?? 'Professional pet healthcare',
    styleBadgeLabel: (style) =>
      style === 'at_center'
        ? 'Clinic Visit'
        : style === 'at_home'
          ? 'Home Visit'
          : style === 'tele'
            ? 'Tele Consultation'
            : STYLE_BADGE[style] ?? 'Appointment',
  },
  grooming: {
    category: 'grooming',
    servicesApiCategory: HUB_DISCOVERY_GROOMING.servicesApiCategory,
    sharePersona: 'grooming',
    headerIcon: Scissors,
    aboutFallback: (name) =>
      `${name} is a professional pet grooming salon offering premium grooming services.`,
    servicesSearchPlaceholder: 'Search services...',
    styleSubtitle: (style) =>
      style === 'at_center'
        ? 'Visit our premium grooming salons'
        : style === 'at_home'
          ? 'Professional groomer comes to you'
          : STYLE_SUBTITLE[style] ?? 'Premium pet grooming services',
    styleBadgeLabel: (style) =>
      style === 'at_center'
        ? 'Grooming Centre'
        : style === 'at_home'
          ? 'At Home Grooming'
          : STYLE_BADGE[style] ?? 'Grooming',
  },
  training: {
    category: 'training',
    servicesApiCategory: HUB_DISCOVERY_TRAINING.servicesApiCategory,
    sharePersona: 'training',
    headerIcon: GraduationCap,
    aboutFallback: (name) => `${name} offers professional pet training services.`,
    servicesSearchPlaceholder: 'Search training services...',
    styleSubtitle: (style) =>
      style === 'at_center'
        ? 'Visit our training centres'
        : style === 'at_home'
          ? 'Trainer comes to you'
          : STYLE_SUBTITLE[style] ?? 'Professional pet training',
    styleBadgeLabel: (style) =>
      style === 'at_center'
        ? 'Training Centre'
        : style === 'at_home'
          ? 'At Home Training'
          : STYLE_BADGE[style] ?? 'Training',
  },
  behaviorist: {
    category: 'behaviorist',
    servicesApiCategory: 'behaviorist',
    sharePersona: 'behaviorist',
    headerIcon: Brain,
    aboutFallback: (name) => `${name} offers professional pet behavior consultation.`,
    servicesSearchPlaceholder: 'Search behavior services...',
    styleSubtitle: (style) =>
      style === 'at_home'
        ? 'Behaviorist visits your home'
        : STYLE_SUBTITLE[style] ?? 'Professional behavior support',
    styleBadgeLabel: (style) =>
      style === 'at_home' ? 'Home Visit' : STYLE_BADGE[style] ?? 'Behaviorist',
  },
  walker: {
    category: 'walker',
    servicesApiCategory: 'walker',
    sharePersona: 'walker',
    headerIcon: Footprints,
    aboutFallback: (name) => `${name} offers trusted dog walking services.`,
    servicesSearchPlaceholder: 'Search walking services...',
    styleSubtitle: (style) =>
      style === 'at_home'
        ? 'Walker comes to your neighbourhood'
        : STYLE_SUBTITLE[style] ?? 'Professional dog walking',
    styleBadgeLabel: (style) =>
      style === 'at_home' ? 'Home Visit' : STYLE_BADGE[style] ?? 'Dog Walker',
  },
  boarding: {
    category: 'boarding',
    servicesApiCategory: 'boarding',
    sharePersona: 'boarding',
    headerIcon: Building2,
    aboutFallback: (name) => `${name} provides safe and comfortable pet boarding.`,
    servicesSearchPlaceholder: 'Search boarding services...',
    styleSubtitle: (style) =>
      style === 'at_center'
        ? 'Visit our boarding facility'
        : STYLE_SUBTITLE[style] ?? 'Professional pet boarding',
    styleBadgeLabel: (style) =>
      style === 'at_center' ? 'Boarding Facility' : STYLE_BADGE[style] ?? 'Boarding',
  },
  sitting: {
    category: 'sitting',
    servicesApiCategory: HUB_DISCOVERY_SITTING.servicesApiCategory,
    sharePersona: 'sitting',
    headerIcon: Home,
    aboutFallback: (name) => `${name} offers trusted in-home pet sitting.`,
    servicesSearchPlaceholder: 'Search sitting services...',
    styleSubtitle: (style) =>
      style === 'at_home'
        ? 'Sitter cares for your pet at home'
        : STYLE_SUBTITLE[style] ?? 'Professional pet sitting',
    styleBadgeLabel: (style) =>
      style === 'at_home' ? 'Home Sitting' : STYLE_BADGE[style] ?? 'Pet Sitter',
  },
  nutrition: {
    category: 'nutrition',
    servicesApiCategory: 'nutrition',
    sharePersona: 'nutrition',
    headerIcon: Apple,
    aboutFallback: (name) => `${name} offers professional pet nutrition consultation.`,
    servicesSearchPlaceholder: 'Search nutrition services...',
    styleSubtitle: (style) =>
      style === 'at_center'
        ? 'Visit our nutrition centre'
        : style === 'at_home'
          ? 'Nutritionist visits your home'
          : STYLE_SUBTITLE[style] ?? 'Professional pet nutrition',
    styleBadgeLabel: (style) =>
      style === 'at_center'
        ? 'Centre Visit'
        : style === 'at_home'
          ? 'Home Visit'
          : STYLE_BADGE[style] ?? 'Nutrition',
  },
};

export function resolveWapptVendorProfileConfig(category: string): WapptVendorProfileConfig {
  const hub = normalizeWapptHubCategory(category);
  if (hub && CATEGORY_CONFIG[hub]) {
    return CATEGORY_CONFIG[hub];
  }
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[wappt] missing profile config for category "${category}"`);
  }
  return CATEGORY_CONFIG.vet;
}

export function listWapptProfileConfiguredCategories(): WapptHubCategory[] {
  return listWapptHubCategories().filter((hub) => Boolean(CATEGORY_CONFIG[hub]));
}

export function resolveWapptStylePlaceholderIcon(serviceStyle: string): LucideIcon {
  if (serviceStyle === 'tele') return Video;
  if (serviceStyle === 'at_home') return Home;
  return Building2;
}
