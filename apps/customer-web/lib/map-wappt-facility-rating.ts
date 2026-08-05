export type WapptFacilityRating = {
  averageRating?: number;
  totalReviews?: number;
};

/** Map GET /customer/facility rating `{ average, count }` → Overview UI shape. */
export function mapWapptFacilityRating(raw: unknown): WapptFacilityRating | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const averageRaw = r.averageRating ?? r.average;
  const countRaw = r.totalReviews ?? r.count;
  const averageRating =
    averageRaw != null && averageRaw !== '' && !Number.isNaN(Number(averageRaw))
      ? Number(averageRaw)
      : undefined;
  const totalReviews =
    countRaw != null && countRaw !== '' && !Number.isNaN(Number(countRaw))
      ? Number(countRaw)
      : undefined;
  if (averageRating == null && totalReviews == null) return null;
  return { averageRating, totalReviews };
}
