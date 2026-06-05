/**
 * Build & call the Java delivery-service to schedule a Pidge rider on vendor kitchen status transitions.
 *
 * Logistics authority boundary:
 * - Java delivery-service: Pidge create-order, POST /webhooks/pidge (status mapping, delivery_tracking +
 *   meal_orders updates, delivered_at, settlement, idempotency), OTP / lifecycle APIs.
 * - Lambda (this module): dispatch initiation only — assemble snapshot and POST meal dispatch to Java.
 *   Do not implement Pidge webhook handling or duplicate delivery state transitions here.
 *
 * Java owns Pidge create + delivery_tracking insert + the `/webhooks/pidge` ingress (single source of truth).
 * Lambda's job is just to assemble the snapshot from `meal_orders` + `meal_plans` + `vendors` + `customers`
 * and POST `{ mealOrderId, prepMinutes, expectedReadyAt, pidgePayload, dispatchTrigger }` to:
 *
 *   POST {DELIVERY_SERVICE_BASE_URL}/logistics/meal/dispatch
 *
 * Idempotent: the Java service returns the existing `delivery_tracking` row if one already exists for
 * this meal order with `logistics_partner='pidge'`.
 *
 * When `MEAL_DISPATCH_REQUIRED` is true (default), `PUT .../meal-orders/.../status`:
 * - Default (`MEAL_PIDGE_DISPATCH_ON=ready_for_pickup`): `ready_for_pickup` runs dispatch first; 422 if it fails.
 * - Legacy (`MEAL_PIDGE_DISPATCH_ON=preparing`): `preparing` runs dispatch first; `ready_for_pickup` requires `pidge_order_id`.
 * Set `MEAL_DISPATCH_REQUIRED=false` only for local/dev without delivery-service.
 *
 * Phase A — Pidge compact payload includes customer commitment:
 * `delivery_date` / `delivery_slot` from scheduled_delivery_* (see meal-pidge-scheduling.ts).
 * `promised_delivery_time` = max(expected_ready_at + 30m, commitment slot end) when commitment is set.
 */

import { query } from '../database/rds-connection';
import { geocodeVendorAddressFields } from './vendor-address-geocode';
import {
  buildMealPidgeSchedulingFields,
  MEAL_PIDGE_DELIVERY_BUFFER_MIN,
} from './meal-pidge-scheduling';
import { resolvePackWeightGramsFromPlanRow } from './meal-pack-weight';
import {
  type MealPidgeDispatchOn,
  isMealLogisticsDispatchStatus,
  mealDispatchFailureUserMessage,
  mealPidgeDispatchOn,
  shouldRequirePidgeBeforeReadyForPickup,
} from './meal-dispatch-policy';

export type { MealPidgeDispatchOn };
export {
  isMealLogisticsDispatchStatus,
  mealDispatchFailureUserMessage,
  mealPidgeDispatchOn,
  shouldRequirePidgeBeforeReadyForPickup,
};

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
  scheduled_delivery_slot: unknown;
  prep_minutes: number | null;
  prep_started_at: string | null;
  expected_ready_at: string | null;
}

/** Lambda runs in VPC; Java ECS + TLS/handshake + cold start can exceed a short client timeout. */
const DISPATCH_FETCH_TIMEOUT_MS = 28_000;

function plusMinutesIso(base: Date, minutes: number): string {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

function safeJsonParse<T = unknown>(s: unknown): T | null {
  if (typeof s !== 'string' || s.trim() === '') return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

/** JSONB columns may be already parsed as an object by node-pg. */
function deliveryAddressRecord(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return safeJsonParse<Record<string, unknown>>(raw) ?? {};
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

/** Undici/Node fetch often sets `error.cause` (syscall errno) — log-friendly for SG/DNS issues. */
function formatFetchFailure(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const parts = [e.message];
  const c = e.cause;
  if (c instanceof Error) {
    parts.push(c.message);
    const code = (c as NodeJS.ErrnoException).code;
    if (code) parts.push(`code=${code}`);
  } else if (c != null && typeof c === 'object' && 'code' in c) {
    parts.push(`code=${String((c as { code: unknown }).code)}`);
  }
  return parts.join(' | ');
}

/** When true (default), the configured dispatch status transition fails if Pidge/delivery-service dispatch fails. */
export function isMealDispatchStrict(): boolean {
  const v = process.env.MEAL_DISPATCH_REQUIRED;
  if (v === undefined || v === '') return true;
  return !['false', '0', 'no'].includes(String(v).trim().toLowerCase());
}

export type MealDispatchStrictGateResult =
  | { proceed: true; dispatchResult: DispatchResult | null }
  | { proceed: false; dispatchResult: DispatchResult; userMessage: string };

/**
 * Strict dispatch gate — call before persisting meal_orders status when MEAL_DISPATCH_REQUIRED is true.
 */
export async function runMealDispatchStrictGate(
  mealOrderId: string,
  status: string,
): Promise<MealDispatchStrictGateResult> {
  const norm = String(status || '').trim().toLowerCase();
  const dispatchOn = mealPidgeDispatchOn();

  if (isMealLogisticsDispatchStatus(norm)) {
    const dispatchResult = await dispatchMealLogistics(mealOrderId, { trigger: dispatchOn });
    if (!dispatchResult.ok) {
      return {
        proceed: false,
        dispatchResult,
        userMessage: dispatchResult.error || mealDispatchFailureUserMessage(dispatchOn),
      };
    }
    return { proceed: true, dispatchResult };
  }

  if (norm === 'ready_for_pickup' && shouldRequirePidgeBeforeReadyForPickup()) {
    const pidgeCheck = await assertMealOrderHasPidgeForPickup(mealOrderId);
    if (!pidgeCheck.ok) {
      return {
        proceed: false,
        dispatchResult: { ok: false, error: pidgeCheck.error },
        userMessage: pidgeCheck.error,
      };
    }
  }

  return { proceed: true, dispatchResult: null };
}

/** Best-effort dispatch after DB update when MEAL_DISPATCH_REQUIRED is false (local dev). */
export async function runMealDispatchBestEffort(
  mealOrderId: string,
  status: string,
): Promise<DispatchResult | null> {
  if (isMealDispatchStrict() || !isMealLogisticsDispatchStatus(status)) {
    return null;
  }
  try {
    return await dispatchMealLogistics(mealOrderId, { trigger: mealPidgeDispatchOn() });
  } catch (e: unknown) {
    console.warn('[meal-dispatch] best-effort dispatch threw:', e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Enforced for `ready_for_pickup` when dispatch still runs on `preparing` (legacy). */
export async function assertMealOrderHasPidgeForPickup(
  mealOrderId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await query(
      `SELECT pidge_order_id FROM meal_orders WHERE id = $1 LIMIT 1`,
      [mealOrderId]
    );
    const row = r.rows[0] as { pidge_order_id?: string | null } | undefined;
    const pid = row?.pidge_order_id;
    if (pid != null && String(pid).trim() !== '') {
      return { ok: true };
    }
    return {
      ok: false,
      error:
        'Cannot mark ready for pickup: no Pidge order is linked yet. Complete "Start preparing" so a rider is scheduled, then try again.',
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Could not verify Pidge link: ${message}` };
  }
}

export type DispatchMealLogisticsOptions = {
  trigger?: MealPidgeDispatchOn;
};

/**
 * Dispatch to delivery-service. Never throws — returns `{ ok:false, error }` on any failure
 * so callers can choose strict vs best-effort behavior.
 */
export async function dispatchMealLogistics(
  mealOrderId: string,
  options?: DispatchMealLogisticsOptions,
): Promise<DispatchResult> {
  try {
    const baseUrl = (process.env.DELIVERY_SERVICE_BASE_URL || '').replace(/\/$/, '');
    if (!baseUrl) {
      console.warn('[meal-dispatch] DELIVERY_SERVICE_BASE_URL not set — skipping Pidge auto-dispatch');
      return { ok: false, error: 'DELIVERY_SERVICE_BASE_URL not set' };
    }

    const moResult = await query(
      `SELECT mo.id, mo.order_number, mo.vendor_id, mo.customer_id, mo.total_amount,
              mo.delivery_address, mo.customer_lat, mo.customer_lng,
              mo.scheduled_delivery_date, mo.scheduled_delivery_slot,
              mo.meal_plan_id, mo.prep_minutes, mo.prep_started_at, mo.expected_ready_at,
              mo.quantity, mo.purchase_snapshot,
              mp.prep_time_minutes AS plan_prep_minutes,
              COALESCE(mp.plan_name, mp.name) AS plan_name,
              mp.price_per_meal AS plan_price,
              mp.pack_weight_grams AS plan_pack_weight_grams,
              mp.dietary_requirements AS plan_dietary_requirements,
              v.business_name AS vendor_name, v.phone AS vendor_phone, v.email AS vendor_email,
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

    const dispatchTrigger = options?.trigger ?? mealPidgeDispatchOn();
    const prepMinutes =
      pickNumber(row.prep_minutes, (row as Record<string, unknown>).plan_prep_minutes) ?? 30;
    const readyNow = new Date();
    let expectedReadyAtIso: string;
    if (dispatchTrigger === 'ready_for_pickup') {
      // Food is ready now — rider should head to pickup immediately.
      expectedReadyAtIso = readyNow.toISOString();
    } else {
      const prepStartedAt = row.prep_started_at ? new Date(row.prep_started_at) : readyNow;
      expectedReadyAtIso =
        typeof row.expected_ready_at === 'string'
          ? new Date(row.expected_ready_at).toISOString()
          : plusMinutesIso(prepStartedAt, prepMinutes);
    }
    const pidgeScheduling = buildMealPidgeSchedulingFields({
      expectedReadyAtIso,
      scheduledDeliveryDate: row.scheduled_delivery_date,
      scheduledDeliverySlot: row.scheduled_delivery_slot,
      bufferMinutes: MEAL_PIDGE_DELIVERY_BUFFER_MIN,
    });
    const promisedDeliveryIso = pidgeScheduling.promised_delivery_time;

    const addr = deliveryAddressRecord(row.delivery_address);
    const customerLat = pickNumber(row.customer_lat, addr.lat, addr.latitude);
    const customerLng = pickNumber(row.customer_lng, addr.lng, addr.longitude);

    const vendorLine1 = pickString((row as Record<string, unknown>).vendor_address);
    const vendorCity = pickString((row as Record<string, unknown>).vendor_city);
    const vendorState = pickString((row as Record<string, unknown>).vendor_state);
    const vendorPincode = pickString((row as Record<string, unknown>).vendor_pincode);
    const vendorLandmark = pickString((row as Record<string, unknown>).vendor_landmark);
    let vendorLat = pickNumber((row as Record<string, unknown>).vendor_lat);
    let vendorLng = pickNumber((row as Record<string, unknown>).vendor_lng);

    // DB coords still null (stale JOIN, legacy row, or coords added after first "preparing" click)
    if (vendorLine1 && (vendorLat == null || vendorLng == null)) {
      try {
        const g = await geocodeVendorAddressFields({
          address: vendorLine1,
          city: vendorCity,
          state: vendorState,
          pincode: vendorPincode,
        });
        if (g) {
          vendorLat = g.latitude;
          vendorLng = g.longitude;
          console.log(`[meal-dispatch] geocode fallback for vendor pickup mealOrderId=${mealOrderId}`);
        }
      } catch (e: unknown) {
        console.warn('[meal-dispatch] geocode fallback failed:', e instanceof Error ? e.message : e);
      }
    }

    if (!vendorLine1 || vendorLat == null || vendorLng == null) {
      console.warn(
        `[meal-dispatch] vendor pickup incomplete mealOrderId=${mealOrderId} hasLine1=${Boolean(vendorLine1)} vendorLat=${vendorLat ?? 'n/a'} vendorLng=${vendorLng ?? 'n/a'}`
      );
      return { ok: false, error: 'vendor pickup address (line1 + lat/lng) missing — cannot dispatch' };
    }
    if (customerLat == null || customerLng == null) {
      return { ok: false, error: 'customer drop coordinates missing — cannot dispatch' };
    }

    const sourceOrderId = pickString(row.order_number, row.id);
    const billAmount = pickNumber(row.total_amount) ?? 0;
    const planName = pickString((row as Record<string, unknown>).plan_name) || 'Meal Order';
    const planPrice = pickNumber((row as Record<string, unknown>).plan_price) ?? billAmount;
    const orderQty = Math.max(1, Math.floor(pickNumber((row as Record<string, unknown>).quantity) ?? 1));
    let packWeightGrams = resolvePackWeightGramsFromPlanRow({
      pack_weight_grams: (row as Record<string, unknown>).plan_pack_weight_grams,
      dietary_requirements: (row as Record<string, unknown>).plan_dietary_requirements,
    });
    if (packWeightGrams == null) {
      const snapRaw = (row as Record<string, unknown>).purchase_snapshot;
      let snap: Record<string, unknown> | null = null;
      if (typeof snapRaw === 'string' && snapRaw.trim()) {
        snap = safeJsonParse<Record<string, unknown>>(snapRaw);
      } else if (typeof snapRaw === 'object' && snapRaw != null && !Array.isArray(snapRaw)) {
        snap = snapRaw as Record<string, unknown>;
      }
      const fromSnap = snap?.packWeightGrams ?? snap?.pack_weight_grams;
      if (fromSnap != null && fromSnap !== '') {
        const n = typeof fromSnap === 'number' ? fromSnap : parseInt(String(fromSnap), 10);
        if (Number.isFinite(n) && n >= 1 && n <= 50_000) packWeightGrams = n;
      }
    }
    if (packWeightGrams == null) {
      console.warn(`[meal-dispatch] missing packWeightGrams mealOrderId=${mealOrderId} mealPlanId=${row.meal_plan_id}`);
      return {
        ok: false,
        error:
          'Cannot schedule delivery: this meal product has no pack weight (grams). Edit the meal product and set pack weight, then try again.',
      };
    }

    const lineWeightGrams = Math.max(1, Math.round(packWeightGrams * orderQty));

    const vendorEmail = pickString((row as Record<string, unknown>).vendor_email);
    const customerEmail = pickString((row as Record<string, unknown>).customer_email);
    const contactEmail =
      vendorEmail ||
      customerEmail ||
      `meal-order+${String(row.id).slice(0, 8)}@notifications.warmpawz.local`;

    const pidgePayload: Record<string, unknown> = {
      /** Meal dispatch uses store/vendor Pidge login — omit brand (no brand.code / location_code). */
      omit_brand: true,
      sourceOrderId,
      sender: {
        name: pickString((row as Record<string, unknown>).vendor_name) || 'Vendor',
        mobile: pickString((row as Record<string, unknown>).vendor_phone),
        email: contactEmail,
        address: {
          address_line_1: vendorLine1,
          city: vendorCity || vendorState || vendorPincode || vendorLine1.slice(0, 40) || 'NA',
          state: vendorState || vendorCity || vendorPincode || 'NA',
          country: 'India',
          pincode: vendorPincode,
          landmark: vendorLandmark || vendorLine1.slice(0, 120),
          lat: vendorLat,
          lng: vendorLng,
        },
      },
      receiver: {
        name: pickString((row as Record<string, unknown>).customer_name) || 'Customer',
        mobile: pickString((row as Record<string, unknown>).customer_phone),
        email: customerEmail || contactEmail,
        address: {
          address_line_1: pickString(addr.address, addr.address_line_1, addr.line1),
          city:
            pickString(addr.city) ||
            pickString(addr.state) ||
            pickString(addr.pincode) ||
            vendorCity ||
            'NA',
          state:
            pickString(addr.state) ||
            pickString(addr.city) ||
            vendorState ||
            vendorCity ||
            pickString(addr.pincode) ||
            'NA',
          country: 'India',
          pincode: pickString(addr.pincode),
          lat: customerLat,
          lng: customerLng,
          landmark:
            pickString(addr.landmark) ||
            pickString(addr.address, addr.address_line_1, addr.line1).slice(0, 120) ||
            'Drop location',
        },
      },
      items: [
        {
          name: planName,
          sku: String((row as Record<string, unknown>).meal_plan_id ?? ''),
          price: planPrice,
          quantity: orderQty,
          weight_g: lineWeightGrams,
          dead_weight: lineWeightGrams,
          packWeightGrams: lineWeightGrams,
        },
      ],
      packageWeightGrams: lineWeightGrams,
      totalWeightGrams: lineWeightGrams,
      billAmount,
      codAmount: 0,
      notes: [],
      promised_prep_time: expectedReadyAtIso,
      promised_delivery_time: promisedDeliveryIso,
      ...(pidgeScheduling.delivery_date
        ? { delivery_date: pidgeScheduling.delivery_date }
        : {}),
      ...(pidgeScheduling.delivery_slot
        ? { delivery_slot: pidgeScheduling.delivery_slot }
        : {}),
    };

    console.log(
      JSON.stringify({
        tag: '[PIDGE DISPATCH]',
        mealOrderId,
        dispatch_trigger: dispatchTrigger,
        order_number: sourceOrderId,
        scheduled_delivery_date: pidgeScheduling.delivery_date,
        scheduled_delivery_slot: pidgeScheduling.delivery_slot,
        scheduled_delivery_slot_raw: row.scheduled_delivery_slot,
        expected_ready_at: expectedReadyAtIso,
        promised_prep_time: expectedReadyAtIso,
        promised_delivery_time: promisedDeliveryIso,
        promised_delivery_rule:
          dispatchTrigger === 'ready_for_pickup'
            ? 'max(now + buffer_min, customer_commitment_at) when commitment valid'
            : 'max(expected_ready_at + buffer_min, customer_commitment_at) when commitment valid',
        buffer_minutes: MEAL_PIDGE_DELIVERY_BUFFER_MIN,
      }),
    );

    const body = JSON.stringify({
      mealOrderId,
      prepMinutes,
      expectedReadyAt: expectedReadyAtIso,
      pidgePayload,
      dispatchTrigger,
    });

    console.log(
      `[meal-dispatch] POST ${baseUrl}/logistics/meal/dispatch mealOrderId=${mealOrderId} pickup=${vendorLine1.slice(0, 40)}…`
    );

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, DISPATCH_FETCH_TIMEOUT_MS);
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
      const name = e instanceof Error ? e.name : '';
      if (timedOut || name === 'AbortError' || /aborted/i.test(message)) {
        console.warn(
          `[meal-dispatch] delivery-service no response within ${DISPATCH_FETCH_TIMEOUT_MS}ms (mealOrderId=${mealOrderId})`
        );
        return {
          ok: false,
          error: `delivery-service timed out after ${DISPATCH_FETCH_TIMEOUT_MS / 1000}s — check ECS delivery-service is healthy, ELB target group, and Lambda VPC/security groups allow egress to the internal load balancer`,
        };
      }
      console.warn('[meal-dispatch] HTTP call failed:', formatFetchFailure(e), e);
      return {
        ok: false,
        error: `delivery-service unreachable: ${formatFetchFailure(e)} — if this persists, ensure the internal delivery ALB security group allows TCP 80 from the API Lambda security group (Pidge/JWT not used on this hop)`,
      };
    } finally {
      clearTimeout(timer);
    }

    const text = await resp.text().catch(() => '');
    let parsed: Record<string, unknown> = {};
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
    if (!resp.ok) {
      const apiErr = typeof parsed.error === 'string' ? parsed.error : null;
      const detail = apiErr || text || 'no body';
      console.warn('[meal-dispatch] delivery-service returned', resp.status, detail.slice(0, 500));
      return { ok: false, error: `HTTP ${resp.status}: ${detail}` };
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
