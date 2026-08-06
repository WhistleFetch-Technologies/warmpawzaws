import { normalizeRatingCount } from '@/lib/rating-display';

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

export type NormalizedFacilityRating = {
  averageRating: number;
  totalReviews: number;
};

function parseStarAverage(value: unknown): number | null {
  const n = typeof value === 'number' ? value : value != null && value !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 5) return null;
  return n;
}

function averageFromReviewRows(reviews: ReadonlyArray<{ rating?: unknown }>): number | null {
  const values: number[] = [];
  for (const r of reviews) {
    const n = parseStarAverage(r.rating);
    if (n != null) values.push(n);
  }
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

/** Normalize GET /customer/facility/:id rating into canonical UI shape. */
export function normalizeFacilityRating(
  raw: unknown,
  options?: {
    recentReviews?: ReadonlyArray<{ rating?: unknown }>;
    fallbackReviewCount?: unknown;
    fallbackAverage?: unknown;
  }
): NormalizedFacilityRating {
  const row =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : ({} as Record<string, unknown>);

  let totalReviews = normalizeRatingCount(
    row.count ??
      row.totalReviews ??
      row.total_reviews ??
      row.review_count ??
      row.reviewCount ??
      row.reviewsCount ??
      row.reviews_count ??
      options?.fallbackReviewCount
  );

  const recentReviews = options?.recentReviews ?? [];
  if (totalReviews <= 0 && recentReviews.length > 0) {
    totalReviews = recentReviews.length;
  }

  let averageRating =
    parseStarAverage(row.average) ??
    parseStarAverage(row.averageRating) ??
    parseStarAverage(row.average_rating) ??
    parseStarAverage(row.avg_rating) ??
    parseStarAverage(row.avgRating) ??
    parseStarAverage(options?.fallbackAverage) ??
    null;

  if (averageRating == null && recentReviews.length > 0) {
    averageRating = averageFromReviewRows(recentReviews);
  }

  return {
    averageRating: averageRating ?? 0,
    totalReviews,
  };
}

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
