import { query } from '../../../../database/rds-connection';
import { mapDbTierToApi } from '../../../warmpawz-appointments/shared/wappt-refund-tier-mapper';
import {
  normalizeWapptHubCategory,
  WAPPT_COMMERCE_MODE,
} from '../../../warmpawz-appointments/shared/wappt-policy.constants';
import { dbListWapptPolicyTiers } from '../../../warmpawz-appointments/admin/policies/repos/wappt-policies-admin.repo';

const BOOKING_SELECT = `
  SELECT b.*,
         b.id AS booking_id,
         b.customer_id,
         b.vendor_id,
         b.service_id,
         b.service_type,
         b.booking_date,
         b.booking_time,
         b.booking_datetime,
         b.scheduled_at,
         b.vendor_timezone,
         b.total_amount,
         b.discount_amount,
         b.payment_status,
         b.status,
         b.commerce_mode,
         b.service_category
  FROM bookings b
`;

export async function dbLoadBookingForCustomer(bookingId: string, customerId: string) {
  const res = await query(
    `${BOOKING_SELECT}
     WHERE b.id = $1::uuid AND b.customer_id = $2::uuid
     LIMIT 1`,
    [bookingId, customerId],
  );
  return res.rows?.[0] ?? null;
}

export async function dbLoadBookingForVendor(bookingId: string, vendorId: string) {
  const res = await query(
    `${BOOKING_SELECT}
     WHERE b.id = $1::uuid AND b.vendor_id = $2::uuid
     LIMIT 1`,
    [bookingId, vendorId],
  );
  return res.rows?.[0] ?? null;
}

export async function dbLoadBookingById(bookingId: string) {
  const res = await query(`${BOOKING_SELECT} WHERE b.id = $1::uuid LIMIT 1`, [bookingId]);
  return res.rows?.[0] ?? null;
}

export async function dbMarkBookingCancelled(
  bookingId: string,
  reason: string,
  cancelledBy: 'pet_parent' | 'provider',
) {
  const res = await query(
    `UPDATE bookings
     SET status = 'cancelled',
         cancellation_reason = $2,
         cancelled_at = NOW(),
         cancelled_by = $3,
         updated_at = NOW()
     WHERE id = $1::uuid AND status NOT IN ('cancelled', 'completed')
     RETURNING *`,
    [bookingId, reason, cancelledBy],
  );
  return res.rows?.[0] ?? null;
}

export async function dbFetchWapptPolicyTiersForCategory(category?: string | null) {
  const slug = category ? normalizeWapptHubCategory(category) : null;
  const categoryRows = slug
    ? await dbListWapptPolicyTiers({ policyScope: 'category', serviceCategory: slug })
    : [];
  const platformRows = await dbListWapptPolicyTiers({ policyScope: 'platform' });
  const useCategory = categoryRows.length > 0;
  const tiers = (useCategory ? categoryRows : platformRows).map((r) =>
    mapDbTierToApi(r as Record<string, unknown>),
  );
  return {
    category: slug,
    policyScope: useCategory ? 'category' : 'platform',
    commerceMode: WAPPT_COMMERCE_MODE,
    tiers,
  };
}

export function rowToBookingForPolicy(row: Record<string, unknown>) {
  return {
    id: String(row.booking_id ?? row.id),
    vendor_id: row.vendor_id,
    service_id: row.service_id,
    service_type: row.service_type,
    booking_datetime: row.booking_datetime ?? null,
    scheduled_at: row.scheduled_at ?? null,
    booking_date: String(row.booking_date ?? '').split('T')[0],
    booking_time: String(row.booking_time ?? ''),
    vendor_timezone: row.vendor_timezone ?? null,
    total_amount: row.total_amount,
    discount_amount: row.discount_amount ?? null,
    commerce_mode: row.commerce_mode ?? null,
    booking_category: row.service_category ?? null,
    service_category: row.service_category ?? null,
  };
}
