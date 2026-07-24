import { query } from '../../../../database/rds-connection';

export type WpayVendorReviewStats = {
  rating: number;
  reviewCount: number;
};

export async function dbWpayVendorReviewStats(vendorId: string): Promise<WpayVendorReviewStats> {
  const result = await query(
    `SELECT
      COALESCE(AVG(rating), 0)::float AS avg_rating,
      COUNT(*)::int AS review_count
    FROM reviews
    WHERE vendor_id = $1`,
    [vendorId]
  );
  const row = result.rows[0] as { avg_rating?: number; review_count?: number } | undefined;
  const rating = Number(row?.avg_rating ?? 0);
  const reviewCount = Number(row?.review_count ?? 0);
  return {
    rating: Number.isFinite(rating) ? Math.round(rating * 10) / 10 : 0,
    reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
  };
}
