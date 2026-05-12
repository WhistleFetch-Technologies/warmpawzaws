/**
 * Build & call the Java delivery-service to schedule a Pidge rider on the vendor "Start Preparing" click.
 *
 * Java owns Pidge create + delivery_tracking insert + the `/webhooks/pidge` ingress (single source of truth).
 * Lambda's job is just to assemble the snapshot from `meal_orders` + `meal_plans` + `vendors` + `customers`
 * and POST `{ mealOrderId, prepMinutes, expectedReadyAt, pidgePayload }` to:
 *
 *   POST {DELIVERY_SERVICE_BASE_URL}/logistics/meal/dispatch
 *
 * Idempotent: the Java service returns the existing `delivery_tracking` row if one already exists for
 * this meal order with `logistics_partner='pidge'`. Failures are non-fatal — the vendor flow continues
 * and the existing "Notify Logistics" / "Dispatched" buttons remain as a manual fallback.
 */

import { query } from '../database/rds-connection';

export interface DispatchResult {
  ok: boolean;
  pidgeOrderId?: string;
  deliveryTrackingId?: string;
  idempotent?: boolean;
  error?: string;
}

interface MealOrderRow {
  id: string;
  order_number: string | null;
  vendor_id: string;
  customer_id: string;
  total_amount: string | number;
  delivery_address: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  scheduled_delivery_date: string | null;
  prep_minutes: number | null;
  prep_started_at: string | null;
  expected_ready_at: string | null;
}

const DEFAULT_DELIVERY_BUFFER_MIN = 30;

function plusMinutesIso(base: Date, minutes: number): string {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

function safeJsonParse<T = unknown>(s: unknown): T | null {
  if (typeof s !== 'string' || s.trim() === '') return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

function pickNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/**
 * Best-effort dispatch. Never throws — returns `{ ok:false, error }` on any failure
 * so the calling status-update endpoint can still return success to the vendor.
 */
export async function dispatchMealLogistics(mealOrderId: string): Promise<DispatchResult> {
  try {
    const baseUrl = (process.env.DELIVERY_SERVICE_BASE_URL || '').replace(/\/$/, '');
    if (!baseUrl) {
      console.warn('[meal-dispatch] DELIVERY_SERVICE_BASE_URL not set — skipping Pidge auto-dispatch');
      return { ok: false, error: 'DELIVERY_SERVICE_BASE_URL not set' };
    }

    const moResult = await query(
      `SELECT mo.id, mo.order_number, mo.vendor_id, mo.customer_id, mo.total_amount,
              mo.delivery_address, mo.customer_lat, mo.customer_lng, mo.scheduled_delivery_date,
              mo.meal_plan_id, mo.prep_minutes, mo.prep_started_at, mo.expected_ready_at,
              mp.prep_time_minutes AS plan_prep_minutes, mp.name AS plan_name, mp.price_per_meal AS plan_price,
              v.business_name AS vendor_name, v.phone AS vendor_phone,
              v.address AS vendor_address, v.city AS vendor_city, v.state AS vendor_state,
              v.pincode AS vendor_pincode, v.landmark AS vendor_landmark,
              v.latitude AS vendor_lat, v.longitude AS vendor_lng,
              c.full_name AS customer_name, c.phone AS customer_phone, c.email AS customer_email
         FROM meal_orders mo
         LEFT JOIN meal_plans mp ON mp.id = mo.meal_plan_id
         LEFT JOIN vendors v ON v.id = mo.vendor_id
         LEFT JOIN customers c ON c.id = mo.customer_id
        WHERE mo.id = $1
        LIMIT 1`,
      [mealOrderId]
    ).catch((e: unknown) => {
      console.error('[meal-dispatch] meal_orders lookup failed:', e);
      return { rows: [] as Array<Record<string, unknown>> };
    });

    if (!moResult.rows || moResult.rows.length === 0) {
      return { ok: false, error: 'meal_order not found' };
    }
    const row = moResult.rows[0] as Record<string, unknown> & MealOrderRow;

    const prepMinutes =
      pickNumber(row.prep_minutes, (row as Record<string, unknown>).plan_prep_minutes) ?? 30;
    const prepStartedAt = row.prep_started_at ? new Date(row.prep_started_at) : new Date();
    const expectedReadyAtIso =
      typeof row.expected_ready_at === 'string'
        ? new Date(row.expected_ready_at).toISOString()
        : plusMinutesIso(prepStartedAt, prepMinutes);
    const expectedDeliveryIso = plusMinutesIso(
      new Date(expectedReadyAtIso),
      DEFAULT_DELIVERY_BUFFER_MIN
    );

    const addr = safeJsonParse<Record<string, unknown>>(row.delivery_address) ?? {};
    const customerLat = pickNumber(row.customer_lat, addr.lat, addr.latitude);
    const customerLng = pickNumber(row.customer_lng, addr.lng, addr.longitude);

    const vendorLine1 = pickString((row as Record<string, unknown>).vendor_address);
    const vendorCity = pickString((row as Record<string, unknown>).vendor_city);
    const vendorState = pickString((row as Record<string, unknown>).vendor_state);
    const vendorPincode = pickString((row as Record<string, unknown>).vendor_pincode);
    const vendorLandmark = pickString((row as Record<string, unknown>).vendor_landmark);
    const vendorLat = pickNumber((row as Record<string, unknown>).vendor_lat);
    const vendorLng = pickNumber((row as Record<string, unknown>).vendor_lng);

    if (!vendorLine1 || vendorLat == null || vendorLng == null) {
      return { ok: false, error: 'vendor pickup address (line1 + lat/lng) missing — cannot dispatch' };
    }
    if (customerLat == null || customerLng == null) {
      return { ok: false, error: 'customer drop coordinates missing — cannot dispatch' };
    }

    const sourceOrderId = pickString(row.order_number, row.id);
    const billAmount = pickNumber(row.total_amount) ?? 0;
    const planName = pickString((row as Record<string, unknown>).plan_name) || 'Meal Order';
    const planPrice = pickNumber((row as Record<string, unknown>).plan_price) ?? billAmount;

    const pidgePayload: Record<string, unknown> = {
      sourceOrderId,
      sender: {
        name: pickString((row as Record<string, unknown>).vendor_name) || 'Vendor',
        mobile: pickString((row as Record<string, unknown>).vendor_phone),
        address: {
          address_line_1: vendorLine1,
          city: vendorCity,
          state: vendorState,
          country: 'India',
          pincode: vendorPincode,
          landmark: vendorLandmark,
          lat: vendorLat,
          lng: vendorLng,
        },
      },
      receiver: {
        name: pickString((row as Record<string, unknown>).customer_name) || 'Customer',
        mobile: pickString((row as Record<string, unknown>).customer_phone),
        email: pickString((row as Record<string, unknown>).customer_email),
        address: {
          address_line_1: pickString(addr.address, addr.address_line_1, addr.line1),
          city: pickString(addr.city),
          state: pickString(addr.state),
          country: 'India',
          pincode: pickString(addr.pincode),
          lat: customerLat,
          lng: customerLng,
          landmark: pickString(addr.landmark),
        },
      },
      items: [
        {
          name: planName,
          sku: String((row as Record<string, unknown>).meal_plan_id ?? ''),
          price: planPrice,
          quantity: 1,
          weight_g: 500,
        },
      ],
      billAmount,
      codAmount: 0,
      notes: [],
      promised_prep_time: expectedReadyAtIso,
      promised_delivery_time: expectedDeliveryIso,
    };

    const body = JSON.stringify({
      mealOrderId,
      prepMinutes,
      expectedReadyAt: expectedReadyAtIso,
      pidgePayload,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let resp: Response;
    try {
      resp = await fetch(`${baseUrl}/logistics/meal/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[meal-dispatch] HTTP call failed:', message);
      return { ok: false, error: `delivery-service unreachable: ${message}` };
    } finally {
      clearTimeout(timer);
    }

    const text = await resp.text().catch(() => '');
    let parsed: Record<string, unknown> = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
    if (!resp.ok) {
      console.warn('[meal-dispatch] delivery-service returned', resp.status, text);
      return { ok: false, error: `HTTP ${resp.status}: ${text || 'no body'}` };
    }
    const pidgeOrderId = typeof parsed.pidgeOrderId === 'string' ? parsed.pidgeOrderId : undefined;
    const deliveryTrackingId =
      typeof parsed.deliveryTrackingId === 'string' ? parsed.deliveryTrackingId : undefined;
    const idempotent = parsed.idempotent === true;
    console.log(
      `[meal-dispatch] ok mealOrderId=${mealOrderId} pidgeOrderId=${pidgeOrderId} idempotent=${idempotent}`
    );
    return { ok: true, pidgeOrderId, deliveryTrackingId, idempotent };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn('[meal-dispatch] unexpected error:', message);
    return { ok: false, error: message };
  }
}
