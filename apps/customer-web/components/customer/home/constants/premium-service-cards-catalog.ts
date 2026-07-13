import type { LucideIcon } from 'lucide-react';
import { Home, MessageCircle, ShoppingBag, PawPrint, Video, Package } from 'lucide-react';

export interface PremiumServiceCardTheme {
  gradientFrom: string;
  gradientTo: string;
  hoverGradientFrom: string;
  hoverGradientTo: string;
  borderClass: string;
  titleClass: string;
  subtitleClass: string;
  badgeBorderClass: string;
  badgeIconClass: string;
  ctaBgClass: string;
  ctaHoverClass: string;
  shadowClass: string;
  hoverShadowClass: string;
  glowClass: string;
  watermarkIcon: LucideIcon;
  watermarkClass: string;
  badgeIcon: LucideIcon;
}

export interface PremiumServiceCardEntry {
  id: string;
  titleLines: [string, string];
  subtitle: string;
  imageUrl: string;
  imageAlt: string;
  /** Horizontal / vertical nudge only — height is shared across all cards. */
  imageNudgeX?: number;
  imageNudgeY?: number;
  screen: string;
  navigateData?: Record<string, unknown>;
  /** When set, card is hidden if the vet style is launch-hidden for the customer. */
  launchServiceId?: string;
  launchServiceStyle?: string;
  /** When true, card requires ecommerce to be enabled. */
  requiresCommerce?: boolean;
  theme: PremiumServiceCardTheme;
}

export const PREMIUM_SERVICE_CARDS: PremiumServiceCardEntry[] = [
  {
    id: 'home-visit',
    titleLines: ['HOME', 'VISIT'],
    subtitle: 'Vet comes to you',
    imageUrl: '/images/home/3cards/home-visit.webp',
    imageAlt: 'Golden retriever with home visit vet kit',
    imageNudgeX: 0,
    imageNudgeY: 0,
    screen: 'home-service-selection',
    launchServiceId: 'vet',
    launchServiceStyle: 'at_home',
    theme: {
      gradientFrom: 'from-emerald-100',
      gradientTo: 'to-emerald-200/90',
      hoverGradientFrom: 'group-hover:from-emerald-200',
      hoverGradientTo: 'group-hover:to-emerald-300/95',
      borderClass: 'border-emerald-300/55',
      titleClass: 'text-emerald-900',
      subtitleClass: 'text-emerald-900/65',
      badgeBorderClass: 'border-emerald-300/90',
      badgeIconClass: 'text-emerald-700',
      ctaBgClass: 'bg-emerald-600',
      ctaHoverClass: 'group-hover:bg-emerald-700',
      shadowClass: 'shadow-[0_4px_20px_rgba(5,150,105,0.22)]',
      hoverShadowClass: 'hover:shadow-[0_10px_32px_rgba(5,150,105,0.32)]',
      glowClass: 'bg-emerald-400/0 group-hover:bg-emerald-400/10',
      watermarkIcon: PawPrint,
      watermarkClass: 'text-emerald-600',
      badgeIcon: Home,
    },
  },
  {
    id: 'tele-consult',
    titleLines: ['TELE', 'CONSULTATION'],
    subtitle: 'Talk to a vet online',
    imageUrl: '/images/home/3cards/tele-consult.webp',
    imageAlt: 'Smartphone showing a video call with a veterinarian',
    imageNudgeX: 2,
    imageNudgeY: 0,
    screen: 'vet-tele-consultation',
    navigateData: { startStep: 'scheduled' },
    launchServiceId: 'vet',
    launchServiceStyle: 'tele',
    theme: {
      gradientFrom: 'from-sky-100',
      gradientTo: 'to-blue-200/90',
      hoverGradientFrom: 'group-hover:from-sky-200',
      hoverGradientTo: 'group-hover:to-blue-300/95',
      borderClass: 'border-blue-300/55',
      titleClass: 'text-blue-900',
      subtitleClass: 'text-blue-900/65',
      badgeBorderClass: 'border-blue-300/90',
      badgeIconClass: 'text-blue-700',
      ctaBgClass: 'bg-blue-600',
      ctaHoverClass: 'group-hover:bg-blue-700',
      shadowClass: 'shadow-[0_4px_20px_rgba(37,99,235,0.22)]',
      hoverShadowClass: 'hover:shadow-[0_10px_32px_rgba(37,99,235,0.32)]',
      glowClass: 'bg-blue-400/0 group-hover:bg-blue-400/10',
      watermarkIcon: Video,
      watermarkClass: 'text-blue-600',
      badgeIcon: MessageCircle,
    },
  },
  {
    id: 'shop-pet-product',
    titleLines: ['SHOP PET', 'PRODUCT'],
    subtitle: 'Food, toys & more',
    imageUrl: '/images/home/3cards/pet-product-shop.webp',
    imageAlt: 'Puppy and kitten with pet products',
    imageNudgeX: 0,
    imageNudgeY: 0,
    screen: 'shop',
    requiresCommerce: true,
    theme: {
      gradientFrom: 'from-violet-100',
      gradientTo: 'to-purple-200/90',
      hoverGradientFrom: 'group-hover:from-violet-200',
      hoverGradientTo: 'group-hover:to-purple-300/95',
      borderClass: 'border-violet-300/55',
      titleClass: 'text-violet-900',
      subtitleClass: 'text-violet-900/65',
      badgeBorderClass: 'border-violet-300/90',
      badgeIconClass: 'text-violet-700',
      ctaBgClass: 'bg-violet-600',
      ctaHoverClass: 'group-hover:bg-violet-700',
      shadowClass: 'shadow-[0_4px_20px_rgba(124,58,237,0.22)]',
      hoverShadowClass: 'hover:shadow-[0_10px_32px_rgba(124,58,237,0.32)]',
      glowClass: 'bg-violet-400/0 group-hover:bg-violet-400/10',
      watermarkIcon: Package,
      watermarkClass: 'text-violet-600',
      badgeIcon: ShoppingBag,
    },
  },
];
