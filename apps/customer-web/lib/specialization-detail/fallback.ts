import { resolveSpecializationHeroImage } from '@/lib/specialization-hub-image-registry';
import type { SpecializationCategory, SpecializationDetailContent, SpecializationResolveContext } from './types';

function humanizeId(id: string): string {
  return id
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Only for admin-created specializations not yet in the registry. */
export function resolveUnknownSpecializationFallback(
  specializationId: string,
  context?: SpecializationResolveContext,
): SpecializationDetailContent {
  const category = context?.category ?? 'general';
  const title = context?.displayName?.trim() || humanizeId(specializationId) || 'Service';
  const description =
    context?.apiDescription?.trim() ||
    `Learn about ${title} and choose how you'd like to receive trusted care from verified providers.`;

  return {
    id: specializationId,
    title,
    description,
    heroImage: resolveSpecializationHeroImage(specializationId, category),
    highlightChips: ['Verified Providers', 'Flexible Modes', 'Trusted Platform'],
    whatsIncluded: [
      { label: 'Qualified Providers', icon: 'badgeCheck' },
      { label: 'Transparent Pricing', icon: 'check' },
      { label: 'Easy Booking', icon: 'calendar' },
      { label: 'Secure Payments', icon: 'shield' },
      { label: 'Customer Support', icon: 'heart' },
      { label: 'Quality Standards', icon: 'star' },
    ],
    benefits: [
      { title: 'Peace of Mind', description: 'Book with confidence on Warmpawz.', icon: 'shield' },
      { title: 'Convenience', description: 'Home or center — your choice.', icon: 'home' },
      { title: 'Trusted Network', description: 'Verified service professionals.', icon: 'badgeCheck' },
      { title: 'Happy Pets', description: 'Care focused on wellbeing.', icon: 'dog' },
    ],
    whoIsThisFor: ['All pet parents', 'First-time bookers', 'Returning customers'],
    timeline: [
      { period: 'Step 1', title: 'Choose service mode' },
      { period: 'Step 2', title: 'Pick a verified provider' },
      { period: 'Step 3', title: 'Book a convenient slot' },
      { period: 'Step 4', title: 'Enjoy quality care' },
    ],
    tips: [
      'Keep vaccinations updated',
      'Share pet medical history',
      'Arrive on time',
      'Bring essentials (leash, carrier)',
    ],
  };
}

export function normalizeCategoryHint(raw?: string): SpecializationCategory {
  const c = String(raw ?? '').toLowerCase();
  if (c.includes('train')) return 'training';
  if (/behav/.test(c)) return 'behavior';
  if (c.includes('walk')) return 'walking';
  if (c.includes('groom')) return 'grooming';
  if (c.includes('board')) return 'boarding';
  if (c.includes('nutrition') || c === 'wellness') return 'nutrition';
  if (c.includes('vet')) return 'vet';
  return 'general';
}
