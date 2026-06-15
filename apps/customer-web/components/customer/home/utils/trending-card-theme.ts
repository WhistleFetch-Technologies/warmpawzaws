import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Flame,
  HeartPulse,
  PawPrint,
  ShieldCheck,
  Smile,
  Sparkles,
  Stethoscope,
} from 'lucide-react';

export interface TrendingCardTheme {
  gradient: string;
  badgeBg: string;
  accentText: string;
  accentBg: string;
  statBg: string;
  Icon: LucideIcon;
}

const RANK_THEMES: TrendingCardTheme[] = [
  {
    gradient: 'from-[#FF6B35] to-[#FF9EC7]',
    badgeBg: 'bg-[#E53935]',
    accentText: 'text-[#E53935]',
    accentBg: 'bg-red-50',
    statBg: 'bg-red-50',
    Icon: Sparkles,
  },
  {
    gradient: 'from-[#7C4DFF] to-[#B388FF]',
    badgeBg: 'bg-[#7C4DFF]',
    accentText: 'text-[#7C4DFF]',
    accentBg: 'bg-purple-50',
    statBg: 'bg-purple-50',
    Icon: Smile,
  },
  {
    gradient: 'from-[#26A69A] to-[#80CBC4]',
    badgeBg: 'bg-[#00897B]',
    accentText: 'text-[#00897B]',
    accentBg: 'bg-teal-50',
    statBg: 'bg-teal-50',
    Icon: HeartPulse,
  },
  {
    gradient: 'from-[#1E88E5] to-[#90CAF9]',
    badgeBg: 'bg-[#1565C0]',
    accentText: 'text-[#1565C0]',
    accentBg: 'bg-blue-50',
    statBg: 'bg-blue-50',
    Icon: ShieldCheck,
  },
];

const TRENDING_NOW_IMAGES_BASE = '/images/home/trending now';

const TITLE_ICON_RULES: { match: RegExp; Icon: LucideIcon }[] = [
  { match: /skin|coat|fur|derma|groom/i, Icon: Sparkles },
  { match: /dental|teeth|tooth|oral/i, Icon: Smile },
  { match: /heart|cardio|cardiovascular/i, Icon: HeartPulse },
  { match: /general|health|wellness|immune/i, Icon: ShieldCheck },
  { match: /walk|exercise|fitness/i, Icon: Activity },
  { match: /vet|medical|doctor/i, Icon: Stethoscope },
  { match: /nutrition|diet|food/i, Icon: PawPrint },
];

const TITLE_IMAGE_RULES: { match: RegExp; src: string }[] = [
  { match: /skin|coat|fur|derma|groom/i, src: `${TRENDING_NOW_IMAGES_BASE}/skun-and-coat.webp` },
  { match: /dental|teeth|tooth|oral/i, src: `${TRENDING_NOW_IMAGES_BASE}/dental-care.webp` },
  { match: /heart|cardio|cardiovascular/i, src: `${TRENDING_NOW_IMAGES_BASE}/heart-and-cardiovascular.webp` },
  { match: /general|health|wellness|immune/i, src: `${TRENDING_NOW_IMAGES_BASE}/general-health.webp` },
];

const RANK_FALLBACK_IMAGES = [
  `${TRENDING_NOW_IMAGES_BASE}/skun-and-coat.webp`,
  `${TRENDING_NOW_IMAGES_BASE}/dental-care.webp`,
  `${TRENDING_NOW_IMAGES_BASE}/heart-and-cardiovascular.webp`,
  `${TRENDING_NOW_IMAGES_BASE}/general-health.webp`,
];

/** Rank-based color theme (cycles after 4). */
export function getTrendingCardTheme(rankIndex: number): TrendingCardTheme {
  return RANK_THEMES[rankIndex % RANK_THEMES.length];
}

/** Pick a Lucide icon from problem title, falling back to rank theme icon. */
export function getTrendingCardIcon(title: string, rankIndex: number): LucideIcon {
  for (const rule of TITLE_ICON_RULES) {
    if (rule.match.test(title)) return rule.Icon;
  }
  return getTrendingCardTheme(rankIndex).Icon;
}

/** Pick a WebP icon from problem title, falling back to rank-based image. */
export function getTrendingCardImage(title: string, rankIndex: number): string {
  for (const rule of TITLE_IMAGE_RULES) {
    if (rule.match.test(title)) return rule.src;
  }
  return RANK_FALLBACK_IMAGES[rankIndex % RANK_FALLBACK_IMAGES.length];
}

/** Decorative growth % shown when API has no weekly delta. */
export const TRENDING_WEEKLY_GROWTH = [24, 18, 15, 12];

/** Small overlapping pet avatars per card row. */
export const TRENDING_AVATAR_SETS: [string, string][] = [
  ['/images/home/vet.jpeg', '/images/home/groomig.jpeg'],
  ['/images/home/walker.jpeg', '/images/home/training.jpeg'],
  ['/images/home/boarding.jpeg', '/images/home/sitter.jpeg'],
  ['/images/home/nutrition.jpeg', '/images/home/vet.jpeg'],
];

export { Flame };
