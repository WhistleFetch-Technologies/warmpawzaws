import { isInterstateIndianSupply, resolveIndianStateKey } from './indian-state-keys';

export const INTRA_STATE_SLA = { minDays: 2, maxDays: 3 } as const;
export const INTER_STATE_SLA = { minDays: 4, maxDays: 5 } as const;
export const DELIVERY_SLA_SOURCE = 'state_sla_v1' as const;
export const LEAD_TIME_MAX_DAYS = 365;

export type DeliverySlaVendorInput = {
  state?: string | null;
  city?: string | null;
  pincode?: string | null;
  shippingOriginPincode?: string | null;
  /** Extra product prep/dispatch days added on top of courier SLA. */
  leadTimeMinDays?: number | null;
  leadTimeMaxDays?: number | null;
};

export type LeadTimePairResult =
  | { ok: true; min: number | null; max: number | null }
  | { ok: false; error: string };

function isBlankLeadInput(raw: unknown): boolean {
  return raw == null || String(raw).trim() === '';
}

/** Whole-number day value, including 0. Rejects decimals and non-numeric strings. */
export function parseLeadTimeDayValue(raw: unknown): number | null {
  if (isBlankLeadInput(raw)) return null;
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isInteger(n)) return null;
  return n;
}

/**
 * Vendor/bulk validation: both empty, or both integers with 0 ≤ min ≤ max ≤ 365.
 * One side filled is an error (do not persist a half pair).
 */
export function parseLeadTimePair(minRaw: unknown, maxRaw: unknown): LeadTimePairResult {
  const minEmpty = isBlankLeadInput(minRaw);
  const maxEmpty = isBlankLeadInput(maxRaw);
  if (minEmpty && maxEmpty) return { ok: true, min: null, max: null };
  if (minEmpty || maxEmpty) {
    return { ok: false, error: 'Lead time min and max days are both required if either is set' };
  }
  const min = parseLeadTimeDayValue(minRaw);
  const max = parseLeadTimeDayValue(maxRaw);
  if (min == null || max == null) {
    return { ok: false, error: 'Lead time must be whole numbers of days' };
  }
  if (min < 0 || max < 0 || min > LEAD_TIME_MAX_DAYS || max > LEAD_TIME_MAX_DAYS) {
    return { ok: false, error: 'Lead time must be between 0 and 365 days' };
  }
  if (min > max) {
    return { ok: false, error: 'Lead time min days cannot be greater than max days' };
  }
  return { ok: true, min, max };
}

/** SLA math: invalid or partial lead time is ignored (courier only). */
export function sanitizeLeadTimeDays(
  minRaw: unknown,
  maxRaw: unknown,
): { min: number; max: number } {
  const parsed = parseLeadTimePair(minRaw, maxRaw);
  if (!parsed.ok || parsed.min == null || parsed.max == null) return { min: 0, max: 0 };
  return { min: parsed.min, max: parsed.max };
}

const IST_TIME_ZONE = 'Asia/Kolkata';

export type DeliverySlaCustomerInput = {
  pincode?: string | null;
  state?: string | null;
  city?: string | null;
};

export type DeliverySlaEstimate = {
  minDays: number;
  maxDays: number;
  deliverByDate: string;
  label: string;
  deliverByLabel: string;
  isInterState: boolean;
  vendorPincode?: string;
  customerPincode: string;
  vendorStateKey?: string;
  customerStateKey?: string;
  source: typeof DELIVERY_SLA_SOURCE;
  confidence: 'high' | 'fallback';
};

export function normalizeIndianPincode(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 6);
  return digits.length === 6 ? digits : null;
}

function resolveVendorPincode(vendor: DeliverySlaVendorInput): string | undefined {
  return (
    normalizeIndianPincode(vendor.shippingOriginPincode) ??
    normalizeIndianPincode(vendor.pincode) ??
    undefined
  );
}

function istYmdParts(from: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(from);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return { year, month, day };
}

function addCalendarDaysIst(daysToAdd: number, from = new Date()): Date {
  const { year, month, day } = istYmdParts(from);
  return new Date(Date.UTC(year, month - 1, day + daysToAdd));
}

function formatDeliverByDateIst(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    timeZone: IST_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function toIsoDateIst(date: Date): string {
  const { year, month, day } = istYmdParts(date);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * State-based delivery SLA for ecommerce PDP (v1).
 * Returns null when customer pincode is missing or invalid.
 */
export function computeDeliverySlaEstimate(
  vendor: DeliverySlaVendorInput,
  customer: DeliverySlaCustomerInput,
  now: Date = new Date(),
): DeliverySlaEstimate | null {
  const customerPincode = normalizeIndianPincode(customer.pincode);
  if (!customerPincode) return null;

  const vendorStateKey = resolveIndianStateKey(vendor.state, vendor.city);
  const customerStateKey = resolveIndianStateKey(customer.state, customer.city);
  const isInterState = isInterstateIndianSupply(customerStateKey, vendorStateKey);
  const confidence: DeliverySlaEstimate['confidence'] =
    vendorStateKey && customerStateKey ? 'high' : 'fallback';

  const courier = isInterState ? INTER_STATE_SLA : INTRA_STATE_SLA;
  const lead = sanitizeLeadTimeDays(vendor.leadTimeMinDays, vendor.leadTimeMaxDays);
  const minDays = courier.minDays + lead.min;
  const maxDays = courier.maxDays + lead.max;
  const deliverBy = addCalendarDaysIst(maxDays, now);

  return {
    minDays,
    maxDays,
    deliverByDate: toIsoDateIst(deliverBy),
    label: `Delivery in ${minDays}–${maxDays} days`,
    deliverByLabel: `Deliver by ${formatDeliverByDateIst(deliverBy)}`,
    isInterState,
    vendorPincode: resolveVendorPincode(vendor),
    customerPincode,
    vendorStateKey,
    customerStateKey,
    source: DELIVERY_SLA_SOURCE,
    confidence,
  };
}

function isSlowerSlaEstimate(
  candidate: DeliverySlaEstimate,
  current: DeliverySlaEstimate,
): boolean {
  if (candidate.maxDays !== current.maxDays) {
    return candidate.maxDays > current.maxDays;
  }
  return candidate.minDays > current.minDays;
}

/**
 * Cart-wide delivery SLA: returns the slowest estimate across all vendor lines.
 * Returns null when customer pincode is missing/invalid or no line is computable.
 */
export function computeCartDeliverySlaEstimate(
  vendors: DeliverySlaVendorInput[],
  customer: DeliverySlaCustomerInput,
  now: Date = new Date(),
): DeliverySlaEstimate | null {
  if (!vendors.length) return null;

  let best: DeliverySlaEstimate | null = null;
  for (const vendor of vendors) {
    const estimate = computeDeliverySlaEstimate(vendor, customer, now);
    if (!estimate) continue;
    if (!best || isSlowerSlaEstimate(estimate, best)) {
      best = estimate;
    }
  }
  return best;
}
