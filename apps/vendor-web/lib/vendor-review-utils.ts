/**
 * Normalizes vendor review API rows (legacy snake_case or enhanced camelCase).
 * Photo field aligns with customer-web submit (`photos`) and GET /reviews/vendor/:id (`photos`).
 */

export interface VendorReviewItem {
  id: string;
  customer_id: string;
  vendor_id: string;
  service_id?: string;
  booking_id?: string;
  rating: number;
  comment?: string;
  /** Resolved display URLs (presigned HTTPS from API when stored as S3 keys). */
  photos: string[];
  is_approved: boolean;
  created_at: string;
  customer_name?: string;
  vendor_name?: string;
  service_name?: string;
}

/** Extract review image URLs from any supported API shape. */
export function extractReviewPhotoUrls(row: Record<string, unknown>): string[] {
  const candidates = [row.photos, row.images, row.review_photos, row.reviewPhotos];

  for (const raw of candidates) {
    if (Array.isArray(raw)) {
      return raw
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .slice(0, 6);
    }
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
            .slice(0, 6);
        }
      } catch {
        /* not JSON */
      }
    }
  }
  return [];
}

export function normalizeVendorReview(row: Record<string, unknown>): VendorReviewItem {
  const comment =
    (typeof row.comment === 'string' ? row.comment : undefined) ??
    (typeof row.review === 'string' ? row.review : undefined);
  const customer_name =
    (typeof row.customer_name === 'string' ? row.customer_name : undefined) ??
    (typeof row.customerName === 'string' ? row.customerName : undefined);
  const created_at =
    (typeof row.created_at === 'string' ? row.created_at : undefined) ??
    (typeof row.createdAt === 'string' ? row.createdAt : undefined) ??
    new Date().toISOString();
  const booking_id =
    (typeof row.booking_id === 'string' ? row.booking_id : undefined) ??
    (typeof row.bookingId === 'string' ? row.bookingId : undefined);
  const service_name =
    (typeof row.service_name === 'string' ? row.service_name : undefined) ??
    (typeof row.serviceName === 'string' ? row.serviceName : undefined);

  return {
    id: String(row.id ?? ''),
    customer_id: String(row.customer_id ?? row.customerId ?? ''),
    vendor_id: String(row.vendor_id ?? row.vendorId ?? ''),
    service_id:
      typeof row.service_id === 'string'
        ? row.service_id
        : typeof row.serviceId === 'string'
          ? row.serviceId
          : undefined,
    booking_id,
    rating: typeof row.rating === 'number' ? row.rating : Number(row.rating) || 0,
    comment,
    photos: extractReviewPhotoUrls(row),
    is_approved:
      typeof row.is_approved === 'boolean'
        ? row.is_approved
        : typeof row.isApproved === 'boolean'
          ? row.isApproved
          : typeof row.is_published === 'boolean'
            ? row.is_published
            : typeof row.isPublished === 'boolean'
              ? row.isPublished
              : true,
    created_at,
    customer_name,
    vendor_name:
      (typeof row.vendor_name === 'string' ? row.vendor_name : undefined) ??
      (typeof row.vendorName === 'string' ? row.vendorName : undefined),
    service_name,
  };
}

export function formatReviewDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function vendorReviewsApiPath(vendorId: string, limit = 100) {
  return `/reviews/vendor/${encodeURIComponent(vendorId)}?limit=${limit}`;
}
