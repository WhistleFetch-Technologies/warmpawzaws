import type { LucideIcon } from 'lucide-react';
import { Home, MessageCircle, PawPrint, Video, ShieldCheck } from 'lucide-react';

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
  /** Image already carries the title, subtitle and CTA — render it as the whole card face. */
  artworkOnly?: boolean;
  theme: PremiumServiceCardTheme;
}

export const PREMIUM_SERVICE_CARDS: PremiumServiceCardEntry[] = [
  {
    id: 'home-visit',
    titleLines: ['HOME', 'VISIT'],
    subtitle: 'Vet comes to you',
    imageUrl: '/images/home/3cards/Picsart_26-07-13_11-55-03-999.png',
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
    subtitle: 'Talk to an expert online',
    imageUrl: '/images/home/3cards/Picsart_26-07-13_11-54-49-722.png',
    imageAlt: 'Dog looking at a smartphone video call with a veterinarian',
    imageNudgeX: 2,
    imageNudgeY: 0,
    screen: 'tele-consultation-hub',
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
    id: 'pet-insurance',
    titleLines: ['FIND BEST', 'INSURANCE'],
    subtitle: 'Compare plans & book a consultation',
    imageUrl: '/images/home/3cards/pet-insurance.webp',
    imageAlt: 'Dog and cat with a paw shield — find the best pet insurance',
    screen: 'insurance',
    artworkOnly: true,
    theme: {
      gradientFrom: 'from-[#d1fadf]',
      gradientTo: 'to-[#c4f2d3]',
      hoverGradientFrom: 'group-hover:from-[#c8f7d8]',
      hoverGradientTo: 'group-hover:to-[#b9edca]',
      borderClass: 'border-emerald-300/55',
      titleClass: 'text-emerald-900',
      subtitleClass: 'text-emerald-900/65',
      badgeBorderClass: 'border-emerald-300/90',
      badgeIconClass: 'text-emerald-700',
      ctaBgClass: 'bg-emerald-700',
      ctaHoverClass: 'group-hover:bg-emerald-800',
      shadowClass: 'shadow-[0_4px_20px_rgba(5,150,105,0.22)]',
      hoverShadowClass: 'hover:shadow-[0_10px_32px_rgba(5,150,105,0.32)]',
      glowClass: 'bg-emerald-400/0 group-hover:bg-emerald-400/10',
      watermarkIcon: ShieldCheck,
      watermarkClass: 'text-emerald-600',
      badgeIcon: ShieldCheck,
    },
  },
];
