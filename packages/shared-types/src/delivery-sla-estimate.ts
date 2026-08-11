import { isInterstateIndianSupply, resolveIndianStateKey } from './indian-state-keys';

export const INTRA_STATE_SLA = { minDays: 2, maxDays: 3 } as const;
export const INTER_STATE_SLA = { minDays: 4, maxDays: 5 } as const;
export const DELIVERY_SLA_SOURCE = 'state_sla_v1' as const;

const IST_TIME_ZONE = 'Asia/Kolkata';

export type DeliverySlaVendorInput = {
  state?: string | null;
  city?: string | null;
  pincode?: string | null;
  shippingOriginPincode?: string | null;
};

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

  const { minDays, maxDays } = isInterState ? INTER_STATE_SLA : INTRA_STATE_SLA;
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
