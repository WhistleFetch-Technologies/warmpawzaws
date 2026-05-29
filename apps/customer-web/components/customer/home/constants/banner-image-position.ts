import type { HomeCarouselBanner } from '../types';

/** Default focal point — pet subjects usually sit on the right in hero art. */
export const DEFAULT_BANNER_OBJECT_POSITION = '65% 35%';

const BANNER_OBJECT_POSITION_BY_TARGET: Record<string, string> = {
  vet: '72% 28%',
  veterinary: '72% 28%',
  walker: '62% 42%',
  walking: '62% 42%',
  grooming: '78% 32%',
  shop: '78% 40%',
  boarding: '70% 35%',
  training: '65% 35%',
  nutritionist: '70% 38%',
  nutrition: '70% 38%',
  pharmacy: '72% 28%',
  adoption: '60% 40%',
};

const BANNER_OBJECT_POSITION_BY_IMAGE: Array<{ pattern: RegExp; position: string }> = [
  { pattern: /dog-peep/i, position: '38% bottom' },
  { pattern: /banner-top-01-vet|banner-vet|\/vet\.jpeg/i, position: '72% 28%' },
  { pattern: /banner-top-02-walk|walker\.jpeg/i, position: '62% 42%' },
  { pattern: /banner-top-03-groom|groomig\.jpeg|grooming/i, position: '78% 32%' },
  { pattern: /banner-top-04-shop|nutrition\.jpeg/i, position: '78% 40%' },
  { pattern: /banner-boarding|boarding\.jpeg/i, position: '70% 35%' },
  { pattern: /banner.*training|training\.jpeg/i, position: '65% 35%' },
];

/** Resolve CSS object-position for hero banner images (presentation only). */
export function resolveBannerObjectPosition(banner: HomeCarouselBanner): string {
  const imageUrl = String(banner.imageUrl || '').toLowerCase();
  for (const { pattern, position } of BANNER_OBJECT_POSITION_BY_IMAGE) {
    if (pattern.test(imageUrl)) return position;
  }

  const id = String(banner.id ?? '').toLowerCase();
  if (id.includes('vet')) return BANNER_OBJECT_POSITION_BY_TARGET.vet;
  if (id.includes('walk')) return BANNER_OBJECT_POSITION_BY_TARGET.walker;
  if (id.includes('groom')) return BANNER_OBJECT_POSITION_BY_TARGET.grooming;

  const cta = String(banner.ctaLink || '').toLowerCase().trim();
  if (BANNER_OBJECT_POSITION_BY_TARGET[cta]) {
    return BANNER_OBJECT_POSITION_BY_TARGET[cta];
  }

  const title = String(banner.title || '').toLowerCase();
  if (title.includes('walk')) return BANNER_OBJECT_POSITION_BY_TARGET.walker;
  if (title.includes('vet') || title.includes('health')) return BANNER_OBJECT_POSITION_BY_TARGET.vet;
  if (title.includes('groom')) return BANNER_OBJECT_POSITION_BY_TARGET.grooming;

  return DEFAULT_BANNER_OBJECT_POSITION;
}
