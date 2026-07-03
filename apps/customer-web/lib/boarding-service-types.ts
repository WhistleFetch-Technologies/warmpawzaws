/**
 * Pet Boarding sub-service slugs (URL ?service= values and in-app filtering).
 *
 * ## Vendor setup — Swimming (same-day pool sessions)
 * 1. Publish a `vendor_services` row under **category = boarding**, **service_style = at_center**.
 * 2. Name the service with swimming keywords (e.g. "Pet Swimming", "Swimming Pool Session").
 * 3. Set **duration_minutes** to the base session length used for pricing (e.g. 60).
 * 4. Set **price** / **custom_price** to the list price for that base duration (INR).
 * 5. Optional: add "Swimming Pool" in facility amenities for discovery trust signals.
 * Customers book via the Boarding hub **Swimming** tile or the vendor profile plan list.
 */
export const BOARDING_SERVICE_SLUGS = [
  'all',
  'overnight',
  'full-day',
  'half-day',
  'swimming',
  'weekend',
  'weekly',
] as const;

export type BoardingServiceSlug = (typeof BOARDING_SERVICE_SLUGS)[number];

export const BOARDING_SERVICE_LABELS: Record<BoardingServiceSlug, string> = {
  all: 'All boarding centers',
  overnight: 'Overnight Boarding',
  'full-day': 'Full Day Boarding',
  'half-day': 'Half Day Boarding',
  swimming: 'Pet Swimming',
  weekend: 'Weekend Boarding',
  weekly: 'Weekly Boarding',
};

/** Keywords to match vendor-published service names/styles to a boarding sub-type */
export const BOARDING_SERVICE_KEYWORDS: Record<BoardingServiceSlug, string[]> = {
  all: [],
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
  swimming: ['swimming', 'swim', 'pool', 'pet swimming', 'swimming pool', 'swim session'],
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

export function serviceNameLooksLikeSwimming(name: string | null | undefined): boolean {
  if (!name) return false;
  return boardingSlugMatchesText('swimming', name);
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
  if (slug === 'all') return true;
  return boardingSlugMatchesText(slug, collectVendorServiceHaystack(vendor));
}
