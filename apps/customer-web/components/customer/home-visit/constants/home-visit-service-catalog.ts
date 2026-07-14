import type { LucideIcon } from 'lucide-react';
import {
  Footprints,
  GraduationCap,
  Home,
  Scissors,
  Stethoscope,
  Users,
  ShieldCheck,
  Clock,
  MapPin,
  Star,
  BadgeCheck,
  Search,
  Calendar,
  Truck,
  Lock,
  Radio,
  Siren,
} from 'lucide-react';

const VET_IMG = '/images/home/Vet';

export type HomeVisitNavigateFn = (screen: string, data?: Record<string, unknown>) => void;

export interface HomeVisitServiceEntry {
  id: string;
  title: string;
  description: string;
  targetScreen: string;
  imageUrl: string;
  Icon: LucideIcon;
  accentKey: string;
  gradient: string;
  ring: string;
  glow: string;
  iconBg: string;
  iconColor: string;
}

export interface HomeVisitQuickStat {
  id: string;
  label: string;
  Icon: LucideIcon;
}

export interface HomeVisitTimelineStep {
  id: string;
  label: string;
  Icon: LucideIcon;
}

export interface HomeVisitTrustItem {
  id: string;
  title: string;
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

export interface HomeVisitPopularEntry {
  id: string;
  title: string;
  imageUrl: string;
  targetScreen: string;
  navigateData?: Record<string, unknown>;
  /**
   * `contain` — image is a transparent-background pet cutout (portrait); fit fully, don't crop.
   * `cover` (default) — image is a full-bleed photo; fill the frame.
   */
  imageFit?: 'cover' | 'contain';
}

export const HOME_VISIT_HERO_IMAGE = `${VET_IMG}/home-visit.webp`;

export const HOME_VISIT_QUICK_STATS: HomeVisitQuickStat[] = [
  { id: 'verified', label: '500+ Verified Professionals', Icon: ShieldCheck },
  { id: 'response', label: '30 Min Response', Icon: Clock },
  { id: 'doorstep', label: 'Doorstep Care', Icon: MapPin },
  { id: 'rating', label: '4.9 Rating', Icon: Star },
];

export const HOME_VISIT_SERVICES: HomeVisitServiceEntry[] = [
  {
    id: 'vet',
    title: 'Vet Home Visit',
    description: 'Doctor visits your home',
    targetScreen: 'vet-home-visit',
    imageUrl: `${VET_IMG}/home-visit.webp`,
    Icon: Stethoscope,
    accentKey: 'vet',
    gradient: 'from-emerald-50/95 via-green-50/90 to-lime-50/95',
    ring: 'ring-emerald-200/70',
    glow: 'hover:shadow-emerald-200/45',
    iconBg: 'bg-emerald-600',
    iconColor: 'text-white',
  },
  {
    id: 'grooming',
    title: 'Grooming',
    description: 'Professional grooming at home',
    targetScreen: 'grooming_home',
    imageUrl: '/images/home/Grooming/home-grooming.webp',
    Icon: Scissors,
    accentKey: 'grooming',
    gradient: 'from-green-50/95 via-emerald-50/90 to-teal-50/95',
    ring: 'ring-green-200/70',
    glow: 'hover:shadow-green-200/45',
    iconBg: 'bg-green-600',
    iconColor: 'text-white',
  },
  {
    id: 'training',
    title: 'Training',
    description: 'Certified trainers',
    targetScreen: 'training_home',
    imageUrl: '/images/home/training.webp',
    Icon: GraduationCap,
    accentKey: 'training',
    gradient: 'from-lime-50/95 via-green-50/90 to-emerald-50/95',
    ring: 'ring-lime-200/70',
    glow: 'hover:shadow-lime-200/45',
    iconBg: 'bg-lime-600',
    iconColor: 'text-white',
  },
  {
    id: 'walking',
    title: 'Walking',
    description: 'Daily exercise',
    targetScreen: 'walker',
    imageUrl: '/images/home/walker.webp',
    Icon: Footprints,
    accentKey: 'walker',
    gradient: 'from-teal-50/95 via-emerald-50/90 to-green-50/95',
    ring: 'ring-teal-200/70',
    glow: 'hover:shadow-teal-200/45',
    iconBg: 'bg-teal-600',
    iconColor: 'text-white',
  },
  {
    id: 'pet-sitting',
    title: 'Pet Sitting',
    description: "Care while you're away",
    targetScreen: 'pet-sitter',
    imageUrl: '/images/home/sitter.webp',
    Icon: Home,
    accentKey: 'pet-sitter',
    gradient: 'from-emerald-50/95 via-green-50/90 to-cyan-50/95',
    ring: 'ring-emerald-200/70',
    glow: 'hover:shadow-emerald-200/45',
    iconBg: 'bg-emerald-700',
    iconColor: 'text-white',
  },
];

export const HOME_VISIT_TIMELINE_STEPS: HomeVisitTimelineStep[] = [
  { id: 'choose', label: 'Choose Service', Icon: Search },
  { id: 'provider', label: 'Select Provider', Icon: Users },
  { id: 'slot', label: 'Book Slot', Icon: Calendar },
  { id: 'arrives', label: 'Professional Arrives', Icon: Truck },
];

export const HOME_VISIT_TRUST_ITEMS: HomeVisitTrustItem[] = [
  {
    id: 'verified',
    title: 'Verified Professionals',
    Icon: BadgeCheck,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  {
    id: 'background',
    title: 'Background Checked',
    Icon: ShieldCheck,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  {
    id: 'doorstep',
    title: 'Doorstep Service',
    Icon: MapPin,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
  },
  {
    id: 'payment',
    title: 'Secure Payment',
    Icon: Lock,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
  },
  {
    id: 'tracking',
    title: 'Live Tracking',
    Icon: Radio,
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-600',
  },
  {
    id: 'emergency',
    title: 'Emergency Support',
    Icon: Siren,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
];

export const HOME_VISIT_POPULAR_ITEMS: HomeVisitPopularEntry[] = [
  {
    id: 'vaccination',
    title: 'Vaccination',
    imageUrl: `${VET_IMG}/card-dog1.webp`,
    imageFit: 'contain',
    targetScreen: 'services_by_problem',
    navigateData: {
      problemId: 'vaccination',
      problemTitle: 'Vaccination',
      roleId: 'veterinarian',
      category: 'veterinarian',
      problem: {
        problemId: 'vaccination',
        title: 'Vaccination',
        name: 'Vaccination',
        roleId: 'veterinarian',
        category: 'veterinarian',
      },
    },
  },
  {
    id: 'health-checkup',
    title: 'Health Checkup',
    imageUrl: `${VET_IMG}/card-dog2.webp`,
    imageFit: 'contain',
    targetScreen: 'services_by_problem',
    navigateData: {
      problemId: 'medicine',
      problemTitle: 'General Health Checkup',
      roleId: 'veterinarian',
      category: 'veterinarian',
      problem: {
        problemId: 'medicine',
        title: 'General Health Checkup',
        name: 'General Health Checkup',
        roleId: 'veterinarian',
        category: 'veterinarian',
      },
    },
  },
  {
    id: 'puppy-care',
    title: 'Puppy Care',
    imageUrl: `${VET_IMG}/card-dog5.webp`,
    imageFit: 'contain',
    targetScreen: 'services_by_problem',
    navigateData: {
      problemId: 'potty_training',
      problemTitle: 'Puppy Care',
      roleId: 'trainer',
      category: 'trainer',
      problem: {
        problemId: 'potty_training',
        title: 'Puppy Care',
        name: 'Puppy Care',
        roleId: 'trainer',
        category: 'trainer',
      },
    },
  },
  {
    id: 'dental',
    title: 'Dental',
    imageUrl: `${VET_IMG}/card-cat2.webp`,
    imageFit: 'contain',
    targetScreen: 'services_by_problem',
    navigateData: {
      problemId: 'dentistry',
      problemTitle: 'Dental',
      roleId: 'veterinarian',
      category: 'veterinarian',
      problem: {
        problemId: 'dentistry',
        title: 'Dental',
        name: 'Dental',
        roleId: 'veterinarian',
        category: 'veterinarian',
      },
    },
  },
  {
    id: 'skin-care',
    title: 'Skin Care',
    imageUrl: `${VET_IMG}/card-cat4.webp`,
    imageFit: 'contain',
    targetScreen: 'services_by_problem',
    navigateData: {
      problemId: 'dermatology',
      problemTitle: 'Skin Care',
      roleId: 'veterinarian',
      category: 'veterinarian',
      problem: {
        problemId: 'dermatology',
        title: 'Skin Care',
        name: 'Skin Care',
        roleId: 'veterinarian',
        category: 'veterinarian',
      },
    },
  },
  {
    id: 'ear-cleaning',
    title: 'Ear Cleaning',
    imageUrl: '/images/home/Grooming/nailtrim.webp',
    targetScreen: 'grooming_home',
  },
  {
    id: 'nutrition',
    title: 'Nutrition',
    imageUrl: '/images/home/nutrition.webp',
    targetScreen: 'nutritionist',
  },
];
