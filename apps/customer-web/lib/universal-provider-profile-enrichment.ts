export type UniversalProviderProfileAbout = {
  bio: string;
  qualifications: string;
  languages: string[];
  address: string;
  city: string;
};

export type UniversalProviderProfileReview = {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
};

type ProviderAboutSeed = {
  bio?: string;
  qualifications?: string;
  degree?: string;
  specialization?: string;
  languages?: string[];
  address?: string;
  city?: string;
};

export function mapFacilityRecentReviews(
  rows: unknown[] | null | undefined
): UniversalProviderProfileReview[] {
  return (rows || []).map((raw, idx) => {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return {
      id: String(r.id ?? `review-${idx}`),
      customerName: String(r.customerName ?? r.customer_name ?? 'Anonymous'),
      rating: Number(r.rating ?? 0) || 0,
      comment: String(r.comment ?? ''),
      date: r.date != null ? String(r.date) : r.created_at != null ? String(r.created_at) : '',
    };
  });
}

export function mergeProviderAboutFromFacility(
  provider: ProviderAboutSeed,
  facilityRes: Record<string, unknown> | null | undefined
): UniversalProviderProfileAbout {
  const vendor =
    facilityRes?.vendor && typeof facilityRes.vendor === 'object'
      ? (facilityRes.vendor as Record<string, unknown>)
      : {};
  const facility =
    facilityRes?.facility && typeof facilityRes.facility === 'object'
      ? (facilityRes.facility as Record<string, unknown>)
      : {};
  const specs = facility.specializations;
  const specStr =
    Array.isArray(specs) && specs.length > 0 ? specs.map((s) => String(s)).join(', ') : '';

  const bio = String(
    facility.description ?? vendor.description ?? provider.bio ?? ''
  ).trim();
  const qualifications = String(
    provider.qualifications ?? provider.degree ?? provider.specialization ?? specStr ?? ''
  ).trim();
  const languages = Array.isArray(provider.languages)
    ? provider.languages.filter(Boolean).map(String)
    : [];
  const address = String(provider.address ?? facility.address ?? vendor.address ?? '').trim();
  const city = String(provider.city ?? facility.city ?? vendor.city ?? '').trim();

  return { bio, qualifications, languages, address, city };
}
