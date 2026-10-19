import { query } from '../../../../database/rds-connection';
import type { VendorFeedbackSourceType } from '../shared/vendor-feedback.types';

export interface VendorFeedbackCandidateRow {
  source_type: VendorFeedbackSourceType;
  source_id: string;
  booking_id: string | null;
  payment_id: string | null;
  vendor_id: string;
  txn_at: string | Date | null;
  booking_style: string | null;
  business_name: string | null;
  owner_name: string | null;
  vendor_type: string | null;
  metadata: unknown;
  profile_photo_url: string | null;
  address: string | null;
  city: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  vendor_status: string | null;
  legacy_category: string | null;
  customer_service: string | null;
  role_category: string | null;
  role_config: unknown;
  role_name: string | null;
  role_display_name: string | null;
  reviewed: boolean;
  dismissed: boolean;
}

/**
 * Customer's single most recent completed transaction (appointment / tele booking
 * or Warmpawz Pay bill), all time, with its vendor card fields and whether it was
 * already reviewed or dismissed. A bill that paid for a booking is the same visit.
 */
export async function dbLatestVendorFeedbackCandidate(
  customerId: string
): Promise<VendorFeedbackCandidateRow | null> {
  const result = await query(
    `WITH bk AS (
       SELECT 'booking'::text AS source_type, b.id AS source_id, b.id AS booking_id,
              NULL::uuid AS payment_id, b.vendor_id, b.completed_at AS txn_at
       FROM bookings b
       WHERE b.customer_id = $1::uuid AND b.status = 'completed' AND b.completed_at IS NOT NULL
       ORDER BY b.completed_at DESC
       LIMIT 1
     ), pb AS (
       SELECT 'payment'::text, p.id, p.booking_id, p.id, p.vendor_id, p.completed_at
       FROM payments p
       WHERE p.customer_id = $1::uuid AND p.payment_source = 'warmpawz_pay'
         AND p.payment_status = 'completed' AND p.completed_at IS NOT NULL
       ORDER BY p.completed_at DESC
       LIMIT 1
     ), latest AS (
       SELECT * FROM (SELECT * FROM bk UNION ALL SELECT * FROM pb) u
       ORDER BY txn_at DESC
       LIMIT 1
     )
     SELECT l.source_type, l.source_id, l.booking_id, l.payment_id, l.vendor_id, l.txn_at,
            NULLIF(COALESCE(lb.service_style, lb.service_type), '') AS booking_style,
            v.business_name, v.owner_name, v.vendor_type, v.metadata, v.profile_photo_url,
            v.address, v.city, v.latitude, v.longitude, v.status AS vendor_status,
            v.category AS legacy_category,
            r.customer_service,
            COALESCE(
              NULLIF(TRIM(r.config->>'category'), ''),
              NULLIF(TRIM(r.config->>'service_category'), ''),
              NULLIF(TRIM(r.config->>'serviceCategory'), ''),
              NULLIF(TRIM(r.role_type), '')
            ) AS role_category,
            r.config AS role_config, r.name AS role_name, r.display_name AS role_display_name,
            EXISTS (
              SELECT 1 FROM reviews rv
              WHERE (l.booking_id IS NOT NULL AND rv.booking_id = l.booking_id)
                 OR (l.payment_id IS NOT NULL AND rv.payment_id = l.payment_id)
            ) AS reviewed,
            EXISTS (
              SELECT 1 FROM customer_feedback_prompts fp
              WHERE fp.customer_id = $1::uuid
                AND ((fp.source_type = l.source_type AND fp.source_id = l.source_id)
                  OR (l.booking_id IS NOT NULL AND fp.source_type = 'booking' AND fp.source_id = l.booking_id))
            ) AS dismissed
     FROM latest l
     JOIN vendors v ON v.id = l.vendor_id AND v.is_deleted IS NOT TRUE
     LEFT JOIN roles r ON r.id = v.role_id
     LEFT JOIN bookings lb ON lb.id = l.booking_id`,
    [customerId]
  );
  return (result.rows[0] as VendorFeedbackCandidateRow | undefined) ?? null;
}
