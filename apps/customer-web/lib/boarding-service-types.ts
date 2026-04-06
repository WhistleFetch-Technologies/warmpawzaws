/**
 * Pet Boarding sub-service slugs (URL ?service= values and in-app filtering).
 */
export const BOARDING_SERVICE_SLUGS = [
  'overnight',
  'full-day',
  'half-day',
  'weekend',
  'weekly',
] as const;

export type BoardingServiceSlug = (typeof BOARDING_SERVICE_SLUGS)[number];

export const BOARDING_SERVICE_LABELS: Record<BoardingServiceSlug, string> = {
  overnight: 'Overnight Boarding',
  'full-day': 'Full Day Boarding',
  'half-day': 'Half Day Boarding',
  weekend: 'Weekend Boarding',
  weekly: 'Weekly Boarding',
};

/** Keywords to match vendor-published service names/styles to a boarding sub-type */
export const BOARDING_SERVICE_KEYWORDS: Record<BoardingServiceSlug, string[]> = {
  overnight: [
    'overnight',
    'night stay',
    'night-stay',
    'night boarding',
    'extended stay',
    'residential',
    'per night',
    'multi-night',
    'multinight',
  ],
  'full-day': ['full day', 'fullday', 'full-day', 'daycare', 'day care', 'day boarding', 'full day boarding'],
  'half-day': ['half day', 'half-day', 'halfday', 'partial day'],
  weekend: ['weekend', 'sat-sun', 'saturday', 'sunday package'],
  weekly: ['weekly', 'week pack', '7 day', '7-day', 'seven day'],
};

export function normalizeBoardingServiceSlug(raw: string | null | undefined): BoardingServiceSlug {
  const s = String(raw || 'overnight')
    .toLowerCase()
    .trim()
    .replace(/_/g, '-');
  if ((BOARDING_SERVICE_SLUGS as readonly string[]).includes(s)) return s as BoardingServiceSlug;
  if (s === 'daycare') return 'full-day';
  return 'overnight';
}

/** Case-insensitive substring match against a haystack built from vendor/service fields */
export function boardingSlugMatchesText(slug: BoardingServiceSlug, text: string): boolean {
  const t = text.toLowerCase();
  return BOARDING_SERVICE_KEYWORDS[slug].some((k) => t.includes(k.toLowerCase()));
}

export function collectVendorServiceHaystack(vendor: Record<string, unknown>): string {
  const parts: string[] = [];
  const push = (v: unknown) => {
    if (v == null) return;
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) v.forEach(push);
    else if (typeof v === 'object') push(JSON.stringify(v));
  };
  push(vendor.serviceName);
  push(vendor.service_name);
  push(vendor.services);
  push(vendor.serviceList);
  push(vendor.vendorServices);
  push(vendor.description);
  push(vendor.businessName);
  push(vendor.name);
  return parts.join(' ');
}

export function vendorOffersBoardingSlug(vendor: Record<string, unknown>, slug: BoardingServiceSlug): boolean {
  return boardingSlugMatchesText(slug, collectVendorServiceHaystack(vendor));
}
