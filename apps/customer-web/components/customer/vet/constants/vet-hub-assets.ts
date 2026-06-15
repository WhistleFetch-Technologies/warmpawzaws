import type { LucideIcon } from 'lucide-react';
import {
  Video,
  Building2,
  Home as HomeIcon,
  FlaskConical,
  Pill,
  Activity,
} from 'lucide-react';

export const VET_IMG = '/images/home/Vet';

export const VET_HEADER_BANNER = `${VET_IMG}/banner-dog-and-cat.webp`;

export const VET_SERVICE_CARDS: {
  id: string;
  name: string;
  description: string;
  image: string;
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  badge: string;
  comingSoon?: boolean;
}[] = [
  {
    id: 'tele',
    name: 'Tele Consultation',
    description: 'Video call with vets',
    image: `${VET_IMG}/tele-consult.webp`,
    Icon: Video,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-100',
    badge: '24/7 Available',
  },
  {
    id: 'clinic',
    name: 'Clinic Visit',
    description: 'Book appointment',
    image: `${VET_IMG}/clinic-visit.webp`,
    Icon: Building2,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    badge: '14 Clinics',
  },
  {
    id: 'home',
    name: 'Home Visit',
    description: 'Vet comes to you',
    image: `${VET_IMG}/home-visit.webp`,
    Icon: HomeIcon,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-100',
    badge: 'Track Live',
  },
  {
    id: 'lab',
    name: 'Lab Tests',
    description: 'Sample collection',
    image: `${VET_IMG}/lab.webp`,
    Icon: FlaskConical,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100',
    badge: 'Digital Reports',
  },
  {
    id: 'medicine',
    name: 'Medicine',
    description: 'Order medicines',
    image: `${VET_IMG}/medicine.webp`,
    Icon: Pill,
    iconColor: 'text-pink-600',
    iconBg: 'bg-pink-100',
    badge: 'Fast Delivery',
    comingSoon: true,
  },
  {
    id: 'physiotherapy',
    name: 'Physiotherapy',
    description: 'Rehabilitation & follow-up',
    image: `${VET_IMG}/physio.webp`,
    Icon: Activity,
    iconColor: 'text-teal-600',
    iconBg: 'bg-teal-100',
    badge: 'Follow-up care',
    comingSoon: true,
  },
];

/** Card pet photos cycled onto consult-by-problem tiles (goal mockup order). */
export const VET_PROBLEM_PET_IMAGES = [
  `${VET_IMG}/card-dog5.webp`,
  `${VET_IMG}/card-cat2.webp`,
  `${VET_IMG}/card-dog5.webp`,
  `${VET_IMG}/card-cat5.webp`,
  `${VET_IMG}/card-dog6.webp`,
  `${VET_IMG}/card-dog1.webp`,
  `${VET_IMG}/card-dog3.webp`,
  `${VET_IMG}/card-dog2.webp`,
  `${VET_IMG}/card-cat1.webp`,
  `${VET_IMG}/card-dog5.webp`,
  `${VET_IMG}/card-dog5.webp`,
  `${VET_IMG}/card-dog4.webp`,
  `${VET_IMG}/card-cat3.webp`,
];

export function isVetGroomingProblem(problem: { id?: string; name?: string }): boolean {
  const id = String(problem.id ?? '').toLowerCase();
  const name = String(problem.name ?? '').toLowerCase();
  return id.includes('groom') || name.includes('groom');
}

export function isVetViewAllProblem(problem: { id?: string }): boolean {
  return String(problem.id ?? '').toLowerCase() === 'view_all';
}
