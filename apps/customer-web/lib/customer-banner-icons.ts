import type { LucideIcon } from 'lucide-react';
import {
  Bone,
  Scissors,
  Stethoscope,
  GraduationCap,
  Dog,
  Home as HomeIcon,
  Heart,
  Coffee,
  Shield,
  Users,
  FlaskConical,
  MapPin,
  Palmtree,
  Phone,
  Wheat,
  Sparkles,
} from 'lucide-react';

/** Resolves a CTA URL to a stable service key for icon + dedupe (used on home and shared banner UIs). */
export function normalizeCustomerBannerTarget(link: unknown): string {
  const raw = String(link ?? '').toLowerCase().trim();
  if (!raw) return '';
  const path = raw.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');
  const segments = path.split(/[/?#]/).map((s) => s.toLowerCase());
  const hay = `${path} ${segments.join(' ')}`;

  const pick = (slug: string) => (hay.includes(slug) ? slug : '');

  if (pick('grooming') || pick('groom')) return 'grooming';
  if (pick('lab-diagnostics') || pick('diagnostics') || pick('diagnostic')) return 'lab-diagnostics';
  if ((pick('vet') || pick('veterinary')) && !hay.includes('walker')) return 'vet';
  if (pick('walker') || pick('walking')) return 'walker';
  if (pick('training') || pick('trainer')) return 'training';
  if (pick('boarding') || pick('board')) return 'boarding';
  if (pick('adoption') || pick('breeder')) return 'adoption';
  if (pick('cafes') || pick('cafe')) return 'cafes';
  if (pick('insurance')) return 'insurance';
  if (pick('photography') || pick('photo')) return 'photography';
  if (pick('pharmacy') || pick('shop') || pick('ecom')) return 'shop';
  if (pick('relocation')) return 'relocation';
  if (pick('resort')) return 'resort';
  if (pick('holiday')) return 'holiday';
  if (pick('sunset')) return 'sunset';
  if (pick('ambulance') || pick('emergency')) return 'ambulance';
  if (pick('nutritionist') || pick('nutrition')) return 'nutritionist';
  if (pick('behaviorist') || pick('behavior')) return 'behaviorist';
  if (pick('mating')) return 'mating-dating-hub';

  const head = (segments[0] || path).toLowerCase();
  return head || raw;
}

function iconForCustomerBannerTarget(target: string): LucideIcon {
  switch (target) {
    case 'shop':
      return Bone;
    case 'grooming':
      return Scissors;
    case 'vet':
      return Stethoscope;
    case 'training':
      return GraduationCap;
    case 'walker':
      return Dog;
    case 'boarding':
      return HomeIcon;
    case 'adoption':
      return Heart;
    case 'cafes':
      return Coffee;
    case 'insurance':
      return Shield;
    case 'photography':
      return Users;
    case 'lab-diagnostics':
      return FlaskConical;
    case 'relocation':
      return MapPin;
    case 'resort':
    case 'holiday':
      return Palmtree;
    case 'ambulance':
      return Phone;
    case 'nutritionist':
      return Wheat;
    case 'behaviorist':
      return Heart;
    case 'mating-dating-hub':
      return Heart;
    case 'sunset':
      return Sparkles;
    default:
      return Sparkles;
  }
}

export function iconForCustomerHomeApiBanner(b: Record<string, unknown>): LucideIcon {
  const target = normalizeCustomerBannerTarget(b.ctaLink ?? b.cta_link);
  return iconForCustomerBannerTarget(target || 'generic');
}
