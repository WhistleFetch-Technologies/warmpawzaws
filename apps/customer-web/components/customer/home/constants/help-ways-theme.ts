import type { LucideIcon } from 'lucide-react';
import {
  Award,
  CreditCard,
  GraduationCap,
  Package,
  PawPrint,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Soup,
  Tag,
  Truck,
} from 'lucide-react';

export interface HelpWayFeatureTag {
  label: string;
  Icon: LucideIcon;
}

export interface HelpWayCardTheme {
  /** Pastel card background */
  cardBg: string;
  /** Accent for badges, explore button, SOON pill */
  accent: string;
  accentLight: string;
  /** Circular badge on photo */
  badgeIcon: LucideIcon;
  /** Large faded watermark behind content */
  watermarkIcon: LucideIcon;
  watermarkClass: string;
  featureTags: HelpWayFeatureTag[];
}

export const HELP_WAY_THEMES: Record<string, HelpWayCardTheme> = {
  insurance: {
    cardBg: 'bg-[#FFF7F0]',
    accent: 'text-[#FF8C42]',
    accentLight: 'bg-[#FF8C42]',
    badgeIcon: ShieldCheck,
    watermarkIcon: Shield,
    watermarkClass: 'text-[#FF8C42]',
    featureTags: [
      { label: 'Cashless claims', Icon: CreditCard },
      { label: 'Best coverage', Icon: Shield },
    ],
  },
  nutrition: {
    cardBg: 'bg-[#F3FBF5]',
    accent: 'text-emerald-600',
    accentLight: 'bg-emerald-500',
    badgeIcon: Soup,
    watermarkIcon: PawPrint,
    watermarkClass: 'text-emerald-500',
    featureTags: [
      { label: 'Custom meal plans', Icon: ShoppingBag },
      { label: 'Vet approved', Icon: ShieldCheck },
    ],
  },
  training: {
    cardBg: 'bg-[#F0F6FF]',
    accent: 'text-blue-600',
    accentLight: 'bg-blue-500',
    badgeIcon: GraduationCap,
    watermarkIcon: Award,
    watermarkClass: 'text-blue-500',
    featureTags: [
      { label: 'Obedience', Icon: Award },
      { label: 'Behavior training', Icon: PawPrint },
    ],
  },
  shop: {
    cardBg: 'bg-[#FFF5F8]',
    accent: 'text-rose-600',
    accentLight: 'bg-rose-500',
    badgeIcon: Package,
    watermarkIcon: Tag,
    watermarkClass: 'text-rose-400',
    featureTags: [
      { label: 'Top brands', Icon: Tag },
      { label: 'Fast delivery', Icon: Truck },
    ],
  },
};

export function getHelpWayTheme(catalogId: string): HelpWayCardTheme {
  return HELP_WAY_THEMES[catalogId] ?? HELP_WAY_THEMES.insurance;
}

/** Only Insurance and Pet Products show the SOON pill. */
export const HELP_WAY_SOON_IDS = new Set(['insurance', 'shop']);
