/**
 * Map customer delivery commitment (meal_orders) to Pidge trip fields.
 * Shared by backend dispatch and vendor prep guidance.
 */

export const MEAL_PIDGE_DELIVERY_BUFFER_MIN = 30;

/** Pidge create-order pattern: HH:mm-HH:mm (no spaces), e.g. 10:15-21:30 */
export const MEAL_PIDGE_SLOT_SEPARATOR = '-';

export type MealDeliverySlotParts = {
  start: string;
  end: string;
};

/** Normalize HH:mm or HH:mm:ss to HH:mm. */
export function normalizeHm(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Parse meal_orders.scheduled_delivery_slot (JSON string or object). */
export function parseScheduledDeliverySlot(raw: unknown): MealDeliverySlotParts | null {
  if (raw == null || raw === '') return null;
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return null;
    if (t.startsWith('{')) {
      try {
        obj = JSON.parse(t) as unknown;
      } catch {
        const hm = normalizeHm(t);
        return hm ? { start: hm, end: hm } : null;
      }
    } else {
      const hm = normalizeHm(t);
      return hm ? { start: hm, end: hm } : null;
    }
  }
  if (typeof obj !== 'object' || obj == null || Array.isArray(obj)) return null;
  const rec = obj as Record<string, unknown>;
  const start = normalizeHm(rec.start ?? (rec.slot as Record<string, unknown> | undefined)?.start);
  if (!start) return null;
  const end = normalizeHm(rec.end ?? (rec.slot as Record<string, unknown> | undefined)?.end) ?? start;
  return { start, end };
}

/** YYYY-MM-DD from Postgres DATE, ISO string, or Date. */
export function formatPidgeDeliveryDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (m) return m[1];
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }
  return null;
}

/**
 * Pidge API `trips[].delivery_slot` — always HH:mm-HH:mm (hyphen, no spaces).
 * Point commitment (start === end): "18:04-18:04"
 * Window: "09:00-12:00"
 */
export function formatPidgeDeliverySlot(slot: MealDeliverySlotParts | null): string | null {
  if (!slot) return null;
  const end = slot.end || slot.start;
  return `${slot.start}${MEAL_PIDGE_SLOT_SEPARATOR}${end}`;
}

/**
 * Customer commitment instant: date + end-of-slot (or start) as local wall clock (IST booking parity).
 */
export function commitmentDeliveryAtMs(
  scheduledDeliveryDate: unknown,
  slot: MealDeliverySlotParts | null,
): number | null {
  const ymd = formatPidgeDeliveryDate(scheduledDeliveryDate);
  if (!ymd || !slot) return null;
  const hm = slot.end || slot.start;
  const d = new Date(`${ymd}T${hm}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

export type ResolvePromisedDeliveryInput = {
  expectedReadyAtIso: string;
  scheduledDeliveryDate?: unknown;
  scheduledDeliverySlot?: unknown;
  bufferMinutes?: number;
};

/**
 * promised_delivery_time = max(expected_ready_at + buffer, customer_commitment_at)
 * when commitment is valid; otherwise expected_ready_at + buffer only.
 */
export function resolvePromisedDeliveryTimeIso(input: ResolvePromisedDeliveryInput): string {
  const bufferMin = input.bufferMinutes ?? MEAL_PIDGE_DELIVERY_BUFFER_MIN;
  const readyMs = new Date(input.expectedReadyAtIso).getTime();
  const operationalMs = readyMs + bufferMin * 60_000;

  const slot = parseScheduledDeliverySlot(input.scheduledDeliverySlot);
  const commitmentMs = commitmentDeliveryAtMs(input.scheduledDeliveryDate, slot);

  const promisedMs =
    commitmentMs != null && Number.isFinite(commitmentMs)
      ? Math.max(operationalMs, commitmentMs)
      : operationalMs;

  return new Date(promisedMs).toISOString();
}

export type MealPidgeSchedulingFields = {
  delivery_date: string | null;
  delivery_slot: string | null;
  promised_delivery_time: string;
  slotParts: MealDeliverySlotParts | null;
};

export function buildMealPidgeSchedulingFields(params: {
  expectedReadyAtIso: string;
  scheduledDeliveryDate?: unknown;
  scheduledDeliverySlot?: unknown;
  bufferMinutes?: number;
}): MealPidgeSchedulingFields {
  const slotParts = parseScheduledDeliverySlot(params.scheduledDeliverySlot);
  return {
    delivery_date: formatPidgeDeliveryDate(params.scheduledDeliveryDate),
    delivery_slot: formatPidgeDeliverySlot(slotParts),
    promised_delivery_time: resolvePromisedDeliveryTimeIso({
      expectedReadyAtIso: params.expectedReadyAtIso,
      scheduledDeliveryDate: params.scheduledDeliveryDate,
      scheduledDeliverySlot: params.scheduledDeliverySlot,
      bufferMinutes: params.bufferMinutes,
    }),
    slotParts,
  };
}
