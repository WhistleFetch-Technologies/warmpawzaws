/**
 * Idempotent V/C/F visit writes. Ecommerce never increments.
 */
import { query } from '../../../database/rds-connection';
import {
  dbAppendBehaviourEvent,
  dbGetBehaviour,
  dbLoadServiceCategories,
  dbLoadVendorRole,
  dbUpsertBehaviour,
} from '../repos/promo-engine.repo';
import { classifyPaymentChannel, isCountChannel } from '../vcf/channel';
import { categoryIdFromVendorRole } from '../vcf/category-from-role';
import type { CountChannel, PaymentChannel } from '../vcf/types';
import {
  decrementVisitProfile,
  incrementVisitProfile,
  parseVisitProfile,
  visitProfileToServicesJson,
} from '../vcf/visit-profile';

const VISIT_EVENT = 'VCF_VISIT';
const REVERSE_EVENT = 'VCF_VISIT_REVERSE';

function parseJson(v: unknown): Record<string, unknown> {
  if (v == null) return {};
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return v as Record<string, unknown>;
}

async function findEvent(userId: string, eventType: string, referenceId: string): Promise<boolean> {
  const res = await query(
    `SELECT id FROM customer_behaviour_events
     WHERE user_id = $1
       AND event_type = $2
       AND payload->>'referenceId' = $3
     LIMIT 1`,
    [userId, eventType, referenceId]
  );
  return Boolean(res.rows?.length);
}

export async function recordVcfVisit(opts: {
  userId: string;
  channel: PaymentChannel | null;
  vendorId?: string | null;
  categoryId?: string | null;
  roleId?: string | null;
  referenceId: string;
}): Promise<{ written: boolean; skipped?: string }> {
  if (!opts.userId || !opts.referenceId) return { written: false, skipped: 'missing_ids' };
  if (!opts.channel || !isCountChannel(opts.channel)) {
    return { written: false, skipped: 'not_a_visit_channel' };
  }
  if (await findEvent(opts.userId, VISIT_EVENT, opts.referenceId)) {
    return { written: false, skipped: 'already_written' };
  }

  const existing = await dbGetBehaviour(opts.userId);
  const overall = parseJson(existing?.overall);
  const services = parseJson(existing?.services);
  const profile = incrementVisitProfile({
    profile: parseVisitProfile(services),
    channel: opts.channel,
    vendorId: opts.vendorId,
    categoryId: opts.categoryId,
    roleId: opts.roleId,
  });

  await dbAppendBehaviourEvent({
    userId: opts.userId,
    eventType: VISIT_EVENT,
    serviceKey: opts.channel,
    payload: {
      referenceId: opts.referenceId,
      channel: opts.channel,
      vendorId: opts.vendorId || null,
      categoryId: opts.categoryId || null,
      roleId: opts.roleId || null,
    },
  });
  await dbUpsertBehaviour({
    userId: opts.userId,
    overall,
    services: visitProfileToServicesJson(services, profile),
  });
  return { written: true };
}

export async function reverseVcfVisit(opts: {
  userId: string;
  referenceId: string;
}): Promise<{ reversed: boolean; skipped?: string }> {
  if (!opts.userId || !opts.referenceId) return { reversed: false, skipped: 'missing_ids' };
  if (await findEvent(opts.userId, REVERSE_EVENT, opts.referenceId)) {
    return { reversed: false, skipped: 'already_reversed' };
  }
  const orig = await query(
    `SELECT payload FROM customer_behaviour_events
     WHERE user_id = $1
       AND event_type = $2
       AND payload->>'referenceId' = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [opts.userId, VISIT_EVENT, opts.referenceId]
  );
  const payload = parseJson(orig.rows?.[0]?.payload);
  if (!payload.channel) return { reversed: false, skipped: 'no_visit' };

  const existing = await dbGetBehaviour(opts.userId);
  const overall = parseJson(existing?.overall);
  const services = parseJson(existing?.services);
  const profile = decrementVisitProfile({
    profile: parseVisitProfile(services),
    channel: payload.channel as CountChannel,
    vendorId: payload.vendorId ? String(payload.vendorId) : null,
    categoryId: payload.categoryId ? String(payload.categoryId) : null,
    roleId: payload.roleId ? String(payload.roleId) : null,
  });

  await dbAppendBehaviourEvent({
    userId: opts.userId,
    eventType: REVERSE_EVENT,
    serviceKey: String(payload.channel),
    payload: { referenceId: opts.referenceId, channel: payload.channel },
  });
  await dbUpsertBehaviour({
    userId: opts.userId,
    overall,
    services: visitProfileToServicesJson(services, profile),
  });
  return { reversed: true };
}

export async function recordVcfVisitFromBooking(booking: {
  id: string;
  customer_id?: string | null;
  vendor_id?: string | null;
  service_type?: string | null;
  service_style?: string | null;
  service_category?: string | null;
  payment_status?: string | null;
  status?: string | null;
}): Promise<{ written: boolean; skipped?: string }> {
  const userId = booking.customer_id ? String(booking.customer_id) : '';
  if (!userId) return { written: false, skipped: 'no_customer' };
  const paid = String(booking.payment_status || '').toLowerCase();
  const completed = String(booking.status || '').toLowerCase() === 'completed';
  if (!completed) return { written: false, skipped: 'not_completed' };
  if (!['paid', 'completed', 'partially_paid', 'success'].includes(paid) && paid !== '') {
    // empty payment_status still counts when the booking is completed (wallet / already paid)
  }
  const channel = classifyPaymentChannel({
    surface: 'booking',
    serviceStyle: booking.service_style || booking.service_type,
  });
  if (!channel || !isCountChannel(channel)) {
    return { written: false, skipped: 'not_a_visit_channel' };
  }

  const vendorId = booking.vendor_id ? String(booking.vendor_id) : null;
  const vendor = vendorId ? await dbLoadVendorRole(vendorId) : null;
  const catalogue = await dbLoadServiceCategories();
  const booked = String(booking.service_category || '').trim();
  const bookedKnown = catalogue.some((row) => String(row.id) === booked) ? booked : null;
  const categoryId =
    bookedKnown ||
    categoryIdFromVendorRole({
      roleId: vendor?.roleId,
      roleName: vendor?.roleName,
      categories: catalogue,
    });

  return recordVcfVisit({
    userId,
    channel,
    vendorId,
    categoryId,
    roleId: vendor?.roleId || null,
    referenceId: String(booking.id),
  });
}

export async function recordVcfVisitFromPayBill(opts: {
  paymentId: string;
  customerId: string;
  vendorId?: string | null;
  bookingCategoryId?: string | null;
}): Promise<{ written: boolean; skipped?: string }> {
  const vendorId = opts.vendorId ? String(opts.vendorId) : null;
  const vendor = vendorId ? await dbLoadVendorRole(vendorId) : null;
  const catalogue = await dbLoadServiceCategories();
  const booked = String(opts.bookingCategoryId || '').trim();
  const bookedKnown = catalogue.some((row) => String(row.id) === booked) ? booked : null;
  const categoryId =
    bookedKnown ||
    categoryIdFromVendorRole({
      roleId: vendor?.roleId,
      roleName: vendor?.roleName,
      categories: catalogue,
    });
  return recordVcfVisit({
    userId: opts.customerId,
    channel: 'paybill',
    vendorId,
    categoryId,
    roleId: vendor?.roleId || null,
    referenceId: opts.paymentId,
  });
}

export async function safeRecordVcfVisitFromBooking(
  booking: Parameters<typeof recordVcfVisitFromBooking>[0]
): Promise<void> {
  try {
    await recordVcfVisitFromBooking(booking);
  } catch (err) {
    console.warn('[vcf] visit write skipped:', err instanceof Error ? err.message : err);
  }
}

export async function safeRecordVcfVisitFromPayBill(
  opts: Parameters<typeof recordVcfVisitFromPayBill>[0]
): Promise<void> {
  try {
    await recordVcfVisitFromPayBill(opts);
  } catch (err) {
    console.warn('[vcf] paybill visit write skipped:', err instanceof Error ? err.message : err);
  }
}

export async function safeReverseVcfVisit(opts: { userId: string; referenceId: string }): Promise<void> {
  try {
    await reverseVcfVisit(opts);
  } catch (err) {
    console.warn('[vcf] visit reverse skipped:', err instanceof Error ? err.message : err);
  }
}
