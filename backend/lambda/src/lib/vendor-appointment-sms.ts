/**
 * Transactional SMS to vendor when a customer books an appointment.
 * Never throws to callers.
 */

import {
  buildVendorAppointmentScheduledSmsBody,
  JIO_VENDOR_APPOINTMENT_SCHEDULED_TEMPLATE_ID,
} from '../constants/jio-vendor-appointment-sms';
import { query, select } from '../database/rds-connection';
import { sendSMS } from '../utils/sms-service';
import { isValidIndianMobile } from './reward-coupon-sms';

type VendorRow = {
  phone?: string | null;
  owner_name?: string | null;
  business_name?: string | null;
};

export function parseMealDeliverySlot(slot: unknown): string {
  let value = slot;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{')) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
      }
    } else {
      return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as { start?: string; slot?: { start?: string } };
    const start = String(obj.start || obj.slot?.start || '09:00').trim();
    return start.length === 5 ? `${start}:00` : start;
  }
  return '09:00:00';
}

export function fireVendorAppointmentScheduledSms(
  params: Parameters<typeof sendVendorAppointmentScheduledSms>[0]
): void {
  void sendVendorAppointmentScheduledSms(params).catch((err) => {
    console.warn('[vendor-appointment-sms] send failed:', err?.message || err);
  });
}

export async function loadVendorContact(
  vendorId: string
): Promise<{ phone: string | null; name: string | null }> {
  const rows = await select('vendors', { id: vendorId });
  const v = rows[0] as VendorRow | undefined;
  if (!v) return { phone: null, name: null };
  const phone = String(v.phone ?? '').trim() || null;
  const name =
    String(v.owner_name ?? v.business_name ?? '').trim() || null;
  return { phone, name };
}

export async function sendVendorAppointmentScheduledSms(params: {
  vendorId: string;
  bookingId: string;
  bookingDate: string;
  bookingTime: string;
  vendor?: VendorRow | null;
}): Promise<{ sent: boolean; reason?: string; messageId?: string }> {
  if (!params.vendorId || !params.bookingId) {
    return { sent: false, reason: 'missing_ids' };
  }

  let phone = params.vendor?.phone?.trim() || null;
  let vendorName =
    params.vendor?.owner_name?.trim() ||
    params.vendor?.business_name?.trim() ||
    null;

  if (!phone || !vendorName) {
    const contact = await loadVendorContact(params.vendorId);
    phone = phone || contact.phone;
    vendorName = vendorName || contact.name;
  }

  if (!phone || !isValidIndianMobile(phone)) {
    return { sent: false, reason: 'no_phone' };
  }

  const message = buildVendorAppointmentScheduledSmsBody({
    vendorName,
    bookingDate: params.bookingDate,
    bookingTime: params.bookingTime,
  });

  const result = await sendSMS({
    to: phone,
    message,
    type: 'transactional',
    senderId: 'WARMPZ',
    templateId: JIO_VENDOR_APPOINTMENT_SCHEDULED_TEMPLATE_ID,
  });

  if (result.success) {
    console.log(
      `[vendor-appointment-sms] sent booking=${params.bookingId} vendor=${params.vendorId} messageId=${result.messageId ?? 'n/a'}`
    );
    return { sent: true, messageId: result.messageId };
  }

  return { sent: false, reason: 'sns_failed' };
}

export async function sendVendorMealOrderScheduledSms(
  order: Record<string, unknown>
): Promise<{ sent: boolean; reason?: string; messageId?: string }> {
  const vendorId = String(order.vendor_id || '').trim();
  const orderId = String(order.id || '').trim();
  const bookingDate = String(
    order.scheduled_delivery_date || order.delivery_date || ''
  )
    .trim()
    .slice(0, 10);
  const bookingTime =
    parseMealDeliverySlot(order.scheduled_delivery_slot) ||
    String(order.delivery_time || '09:00:00');

  if (!vendorId || !orderId || !bookingDate) {
    return { sent: false, reason: 'missing_meal_order_fields' };
  }

  return sendVendorAppointmentScheduledSms({
    vendorId,
    bookingId: orderId,
    bookingDate,
    bookingTime,
  });
}

export async function sendVendorMealSubscriptionScheduledSms(
  subscriptionId: string,
  vendorIdHint?: string | null
): Promise<{ sent: boolean; reason?: string; messageId?: string }> {
  const sid = String(subscriptionId || '').trim();
  if (!sid) return { sent: false, reason: 'missing_subscription_id' };

  const r = await query(
    `SELECT d.delivery_date::text AS delivery_date,
            d.delivery_time_slot,
            s.vendor_id::text AS vendor_id,
            s.delivery_schedule_json
     FROM meal_subscription_deliveries d
     INNER JOIN meal_subscriptions s ON s.id = d.subscription_id
     WHERE d.subscription_id = $1::uuid
     ORDER BY d.session_number ASC
     LIMIT 1`,
    [sid]
  ).catch(() => ({ rows: [] }));

  const row = r.rows?.[0] as Record<string, unknown> | undefined;
  if (row?.delivery_date) {
    const vendorId = String(row.vendor_id || vendorIdHint || '').trim();
    return sendVendorAppointmentScheduledSms({
      vendorId,
      bookingId: sid,
      bookingDate: String(row.delivery_date).slice(0, 10),
      bookingTime: parseMealDeliverySlot(row.delivery_time_slot),
    });
  }

  const subRes = await query(
    `SELECT vendor_id::text AS vendor_id,
            next_delivery_date::text AS next_delivery_date,
            start_date::text AS start_date,
            delivery_schedule_json
     FROM meal_subscriptions
     WHERE id = $1::uuid
     LIMIT 1`,
    [sid]
  ).catch(() => ({ rows: [] }));
  const sub = subRes.rows?.[0] as Record<string, unknown> | undefined;
  const vendorId = String(sub?.vendor_id || vendorIdHint || '').trim();
  const bookingDate = String(sub?.next_delivery_date || sub?.start_date || '')
    .trim()
    .slice(0, 10);
  if (!vendorId || !bookingDate) {
    return { sent: false, reason: 'missing_subscription_schedule' };
  }

  return sendVendorAppointmentScheduledSms({
    vendorId,
    bookingId: sid,
    bookingDate,
    bookingTime: parseMealDeliverySlot(sub?.delivery_schedule_json),
  });
}

export function fireVendorMealOrderScheduledSms(order: Record<string, unknown>): void {
  void sendVendorMealOrderScheduledSms(order).catch((err) => {
    console.warn('[vendor-appointment-sms] meal order send failed:', err?.message || err);
  });
}

export function fireVendorMealSubscriptionScheduledSms(
  subscriptionId: string,
  vendorIdHint?: string | null
): void {
  void sendVendorMealSubscriptionScheduledSms(subscriptionId, vendorIdHint).catch((err) => {
    console.warn('[vendor-appointment-sms] meal subscription send failed:', err?.message || err);
  });
}
