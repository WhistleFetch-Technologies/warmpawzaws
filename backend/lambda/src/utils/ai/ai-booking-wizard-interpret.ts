/**
 * Allowlisted JSON actions for POST .../booking-session/:id/interpret.
 * Unknown keys are discarded; values are validated before merge.
 */

const ALLOWED_CATEGORIES = new Set([
  'vet',
  'grooming',
  'training',
  'boarding',
  'walker',
  'walking',
  'pharmacy',
  'cafe',
  'resort',
  'nutrition',
  'sitting',
]);

const ALLOWED_SERVICE_STYLES = new Set([
  'at_center',
  'at_home',
  'at_vendor',
  'tele',
  'ecom',
  'hybrid',
  'product',
]);

export type InterpretAction =
  | { type: 'setCategory'; category: string }
  | { type: 'setVendorId'; vendorId: string }
  | { type: 'setVendorServiceId'; vendorServiceId: string }
  | { type: 'setServiceStyle'; serviceStyle: string }
  | { type: 'setBookingDate'; bookingDate: string }
  | { type: 'setSlotTime'; slotTime: string }
  | { type: 'setTotalDuration'; totalDuration: number }
  | { type: 'setPetId'; petId: string }
  | { type: 'setAddressId'; addressId: string }
  | { type: 'setStaffId'; staffId: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asTrimmedString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

export function parseInterpretActionsFromModelJson(raw: string): InterpretAction[] {
  let obj: unknown;
  try {
    obj = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  if (!obj || typeof obj !== 'object') return [];
  const root = obj as Record<string, unknown>;
  const arr = root.actions ?? root.action;
  if (!Array.isArray(arr)) return [];

  const out: InterpretAction[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const a = item as Record<string, unknown>;
    const type = asTrimmedString(a.type)?.toLowerCase();
    if (!type) continue;

    if (type === 'setcategory') {
      const c = asTrimmedString(a.category)?.toLowerCase().replace(/-/g, '_') || '';
      if (ALLOWED_CATEGORIES.has(c)) out.push({ type: 'setCategory', category: c });
      continue;
    }
    if (type === 'setvendorid') {
      const id = asTrimmedString(a.vendorId);
      if (id && UUID_RE.test(id)) out.push({ type: 'setVendorId', vendorId: id });
      continue;
    }
    if (type === 'setvendorserviceid') {
      const id = asTrimmedString(a.vendorServiceId) ?? asTrimmedString(a.serviceId);
      if (id && UUID_RE.test(id)) out.push({ type: 'setVendorServiceId', vendorServiceId: id });
      continue;
    }
    if (type === 'setservicestyle') {
      const st = asTrimmedString(a.serviceStyle) || '';
      if (ALLOWED_SERVICE_STYLES.has(st)) out.push({ type: 'setServiceStyle', serviceStyle: st });
      continue;
    }
    if (type === 'setbookingdate') {
      const d = asTrimmedString(a.bookingDate) ?? asTrimmedString(a.date);
      if (d && DATE_RE.test(d)) out.push({ type: 'setBookingDate', bookingDate: d });
      continue;
    }
    if (type === 'setslottime') {
      const t = asTrimmedString(a.slotTime) ?? asTrimmedString(a.time);
      if (t && t.length <= 32) out.push({ type: 'setSlotTime', slotTime: t });
      continue;
    }
    if (type === 'settotalduration') {
      const n = Number(a.totalDuration);
      if (Number.isFinite(n) && n >= 15 && n <= 24 * 60) {
        out.push({ type: 'setTotalDuration', totalDuration: Math.round(n) });
      }
      continue;
    }
    if (type === 'setpetid') {
      const id = asTrimmedString(a.petId);
      if (id && UUID_RE.test(id)) out.push({ type: 'setPetId', petId: id });
      continue;
    }
    if (type === 'setaddressid') {
      const id = asTrimmedString(a.addressId);
      if (id && UUID_RE.test(id)) out.push({ type: 'setAddressId', addressId: id });
      continue;
    }
    if (type === 'setstaffid') {
      const id = asTrimmedString(a.staffId);
      if (id && id.length <= 64) out.push({ type: 'setStaffId', staffId: id });
      continue;
    }
  }
  return out;
}

export type SessionPatchFields = {
  category?: string;
  vendor_id?: string | null;
  vendor_service_id?: string | null;
  service_style?: string | null;
  booking_date?: string | null;
  slot_time?: string | null;
  total_duration?: number;
  pet_id?: string | null;
  address_id?: string | null;
  staff_id?: string | null;
};

/** Deterministic visit-type switch from chat (before Bedrock interpret). */
export function inferVisitStyleFromMessage(message: string): 'at_center' | 'at_home' | 'tele' | null {
  const m = String(message || '')
    .toLowerCase()
    .trim();
  if (!m) return null;
  if (/\b(tele|video\s*consult|online\s*consult|virtual\s*visit|video\s*call)\b/.test(m)) {
    return 'tele';
  }
  if (/\b(home\s*visit|at\s*home|home\s*service|visit\s*at\s*home)\b/.test(m)) {
    return 'at_home';
  }
  if (
    /\b(clinic\s*visit|in[- ]?clinic|at\s*(the\s*)?clinic|at\s*center|at\s*centre|office\s*visit|in\s*person)\b/.test(
      m
    )
  ) {
    return 'at_center';
  }
  return null;
}

export function visitStyleAssistantMessage(style: 'at_center' | 'at_home' | 'tele'): string {
  if (style === 'tele') {
    return 'Switched to tele / video visit. Pick a service, then a date with openings.';
  }
  if (style === 'at_home') {
    return 'Switched to home visit. Pick a service, then a date with openings.';
  }
  return 'Switched to in-clinic visit. Pick a service, then a date with openings.';
}

export function interpretActionsToPatch(actions: InterpretAction[]): SessionPatchFields {
  const patch: SessionPatchFields = {};
  for (const a of actions) {
    switch (a.type) {
      case 'setCategory':
        patch.category = a.category;
        break;
      case 'setVendorId':
        patch.vendor_id = a.vendorId;
        break;
      case 'setVendorServiceId':
        patch.vendor_service_id = a.vendorServiceId;
        break;
      case 'setServiceStyle':
        patch.service_style = a.serviceStyle;
        break;
      case 'setBookingDate':
        patch.booking_date = a.bookingDate;
        break;
      case 'setSlotTime':
        patch.slot_time = a.slotTime;
        break;
      case 'setTotalDuration':
        patch.total_duration = a.totalDuration;
        break;
      case 'setPetId':
        patch.pet_id = a.petId;
        break;
      case 'setAddressId':
        patch.address_id = a.addressId;
        break;
      case 'setStaffId':
        patch.staff_id = a.staffId;
        break;
      default:
        break;
    }
  }
  return patch;
}
