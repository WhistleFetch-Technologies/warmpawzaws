import { query } from '../database/rds-connection';

export type MealKitchenOffReason = 'closed_today' | 'holiday' | 'kitchen_maintenance' | 'custom';

export interface MealKitchenAvailability {
  acceptingOrders: boolean;
  reasonCode: MealKitchenOffReason | null;
  customerMessage: string | null;
  updatedAt: string | null;
}

const PRESET_MESSAGES: Record<Exclude<MealKitchenOffReason, 'custom'>, string> = {
  closed_today: "We're closed today and not taking new meal orders.",
  holiday: "We're on holiday and not taking new meal orders right now.",
  kitchen_maintenance: 'Kitchen maintenance — please check back soon.',
};

const CUSTOM_MESSAGE_MAX = 120;

function parseVendorMetadata(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeReasonCode(v: unknown): MealKitchenOffReason | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (s === 'closed_today' || s === 'holiday' || s === 'kitchen_maintenance' || s === 'custom') {
    return s;
  }
  return null;
}

export function parseMealKitchenAvailabilityFromMetadata(
  metadata: unknown,
): MealKitchenAvailability {
  const meta = parseVendorMetadata(metadata);
  const block = meta.mealKitchenAvailability;
  if (!block || typeof block !== 'object' || Array.isArray(block)) {
    return {
      acceptingOrders: true,
      reasonCode: null,
      customerMessage: null,
      updatedAt: null,
    };
  }
  const o = block as Record<string, unknown>;
  const acceptingOrders = o.acceptingOrders !== false;
  const reasonCode = normalizeReasonCode(o.reasonCode);
  const customerMessage =
    typeof o.customerMessage === 'string' && o.customerMessage.trim()
      ? o.customerMessage.trim().slice(0, CUSTOM_MESSAGE_MAX)
      : null;
  const updatedAt =
    typeof o.updatedAt === 'string' && o.updatedAt.trim() ? o.updatedAt.trim() : null;
  return { acceptingOrders, reasonCode, customerMessage, updatedAt };
}

export function resolveCustomerKitchenMessage(avail: MealKitchenAvailability): string {
  if (avail.acceptingOrders) return '';
  if (avail.customerMessage) return avail.customerMessage;
  if (avail.reasonCode && avail.reasonCode !== 'custom') {
    return PRESET_MESSAGES[avail.reasonCode];
  }
  return "This kitchen isn't taking new orders right now.";
}

export function buildMealKitchenAvailabilityPayload(body: {
  acceptingOrders?: boolean;
  reasonCode?: string | null;
  customerMessage?: string | null;
}): { ok: true; value: MealKitchenAvailability } | { ok: false; error: string } {
  const acceptingOrders = body.acceptingOrders !== false;
  let reasonCode = normalizeReasonCode(body.reasonCode);
  let customerMessage =
    typeof body.customerMessage === 'string' && body.customerMessage.trim()
      ? body.customerMessage.trim().slice(0, CUSTOM_MESSAGE_MAX)
      : null;

  if (!acceptingOrders) {
    if (!reasonCode) {
      reasonCode = 'closed_today';
    }
    if (reasonCode === 'custom') {
      if (!customerMessage) {
        return { ok: false, error: 'Add a short note for customers when using Custom reason' };
      }
    } else {
      customerMessage = PRESET_MESSAGES[reasonCode];
    }
  } else {
    reasonCode = null;
    customerMessage = null;
  }

  return {
    ok: true,
    value: {
      acceptingOrders,
      reasonCode,
      customerMessage,
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function fetchMealKitchenAvailabilityForVendor(
  vendorId: string,
): Promise<MealKitchenAvailability> {
  const r = await query(`SELECT metadata FROM vendors WHERE id = $1 LIMIT 1`, [vendorId]);
  if (!r.rows?.length) {
    return parseMealKitchenAvailabilityFromMetadata(null);
  }
  return parseMealKitchenAvailabilityFromMetadata((r.rows[0] as { metadata: unknown }).metadata);
}

export async function assertVendorAcceptingMealOrders(
  vendorId: string,
): Promise<{ allowed: true } | { allowed: false; message: string; code: string }> {
  const avail = await fetchMealKitchenAvailabilityForVendor(vendorId);
  if (avail.acceptingOrders) return { allowed: true };
  return {
    allowed: false,
    message: resolveCustomerKitchenMessage(avail),
    code: 'MEAL_KITCHEN_NOT_ACCEPTING',
  };
}

export type PublicMealKitchenAvailability = {
  acceptingOrders: boolean;
  message: string | null;
};

export function toPublicMealKitchenAvailability(
  avail: MealKitchenAvailability,
): PublicMealKitchenAvailability {
  return {
    acceptingOrders: avail.acceptingOrders,
    message: avail.acceptingOrders ? null : resolveCustomerKitchenMessage(avail),
  };
}

/** Batch-load kitchen status for customer meal browse (no auth required). */
export async function fetchMealKitchenAvailabilityMap(
  vendorIds: string[],
): Promise<Map<string, PublicMealKitchenAvailability>> {
  const uniq = [...new Set(vendorIds.map((id) => String(id || '').trim()).filter(Boolean))];
  const map = new Map<string, PublicMealKitchenAvailability>();
  if (!uniq.length) return map;

  const r = await query(`SELECT id, metadata FROM vendors WHERE id = ANY($1::uuid[])`, [uniq]);
  for (const row of r.rows || []) {
    const id = String((row as { id: string }).id);
    const avail = parseMealKitchenAvailabilityFromMetadata((row as { metadata: unknown }).metadata);
    map.set(id, toPublicMealKitchenAvailability(avail));
  }
  for (const id of uniq) {
    if (!map.has(id)) {
      map.set(id, { acceptingOrders: true, message: null });
    }
  }
  return map;
}

export function kitchenFieldsForVendorId(
  vendorId: string,
  map: Map<string, PublicMealKitchenAvailability>,
): { acceptingMealOrders: boolean; kitchenClosedMessage: string | null } {
  const k = map.get(String(vendorId || '').trim()) ?? { acceptingOrders: true, message: null };
  return {
    acceptingMealOrders: k.acceptingOrders,
    kitchenClosedMessage: k.message,
  };
}

export async function enrichMealPlanRowsWithKitchenAvailability<
  T extends { vendor_id?: unknown; vendorId?: unknown },
>(rows: T[]): Promise<
  (T & { acceptingMealOrders: boolean; kitchenClosedMessage: string | null })[]
> {
  const vendorIds = rows.map((r) => String(r.vendor_id ?? r.vendorId ?? ''));
  const map = await fetchMealKitchenAvailabilityMap(vendorIds);
  return rows.map((row) => {
    const vid = String(row.vendor_id ?? row.vendorId ?? '');
    const fields = kitchenFieldsForVendorId(vid, map);
    return { ...row, ...fields };
  });
}

export { CUSTOM_MESSAGE_MAX, PRESET_MESSAGES };
