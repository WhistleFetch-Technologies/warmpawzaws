import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  Clock,
  Heart,
  MapPin,
  PawPrint,
  Scissors,
  Shield,
  Stethoscope,
  Truck,
  User,
} from 'lucide-react';

export interface ForYouBadge {
  label: string;
  Icon: LucideIcon;
  iconClass: string;
  bgClass: string;
}

export interface ForYouCardTheme {
  overlayIcon: LucideIcon;
  overlayIconClass: string;
  overlayBgClass: string;
  backgroundIcon: LucideIcon;
  backgroundIconClass: string;
  badges: ForYouBadge[];
}

const VET_THEME: ForYouCardTheme = {
  overlayIcon: Heart,
  overlayIconClass: 'text-white',
  overlayBgClass: 'bg-red-500',
  backgroundIcon: Stethoscope,
  backgroundIconClass: 'text-red-200',
  badges: [
    { label: 'Expert Vets', Icon: User, iconClass: 'text-orange-500', bgClass: 'bg-orange-50' },
    { label: 'Online & Offline', Icon: MapPin, iconClass: 'text-emerald-500', bgClass: 'bg-emerald-50' },
    { label: 'Quick Support', Icon: Clock, iconClass: 'text-violet-500', bgClass: 'bg-violet-50' },
  ],
};

const GROOMING_THEME: ForYouCardTheme = {
  overlayIcon: Scissors,
  overlayIconClass: 'text-white',
  overlayBgClass: 'bg-violet-500',
  backgroundIcon: Scissors,
  backgroundIconClass: 'text-violet-200',
  badges: [
    { label: 'Trusted Groomers', Icon: PawPrint, iconClass: 'text-violet-500', bgClass: 'bg-violet-50' },
    { label: 'Hygienic Care', Icon: Shield, iconClass: 'text-emerald-500', bgClass: 'bg-emerald-50' },
    { label: 'Pickup Available', Icon: Truck, iconClass: 'text-blue-500', bgClass: 'bg-blue-50' },
  ],
};

const WALKER_THEME: ForYouCardTheme = {
  overlayIcon: PawPrint,
  overlayIconClass: 'text-white',
  overlayBgClass: 'bg-emerald-500',
  backgroundIcon: PawPrint,
  backgroundIconClass: 'text-emerald-200',
  badges: [
    { label: 'Verified Walkers', Icon: User, iconClass: 'text-orange-500', bgClass: 'bg-orange-50' },
    { label: 'GPS Tracked', Icon: Shield, iconClass: 'text-emerald-500', bgClass: 'bg-emerald-50' },
    { label: 'Flexible Plans', Icon: Calendar, iconClass: 'text-violet-500', bgClass: 'bg-violet-50' },
  ],
};

const THEME_BY_SCREEN: Record<string, ForYouCardTheme> = {
  vet: VET_THEME,
  veterinary: VET_THEME,
  grooming: GROOMING_THEME,
  walker: WALKER_THEME,
  walking: WALKER_THEME,
};

const THEME_BY_ID: Record<string, ForYouCardTheme> = {
  vet: VET_THEME,
  grooming: GROOMING_THEME,
  walker: WALKER_THEME,
};

/** Visual theme (badges, overlay & background icons) for a For You card. */
export function getForYouCardTheme(screen: string, id?: string): ForYouCardTheme {
  const byScreen = THEME_BY_SCREEN[screen.toLowerCase().trim()];
  if (byScreen) return byScreen;
  if (id) {
    const byId = THEME_BY_ID[id.toLowerCase().trim()];
    if (byId) return byId;
  }
  return VET_THEME;
}
