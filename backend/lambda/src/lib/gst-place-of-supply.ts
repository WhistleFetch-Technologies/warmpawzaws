/**
 * Resolve Indian state for GST intra- vs inter-state (place of supply).
 * Handles: city-only payloads, city wrongly stored in `state`, KA/MH codes, plain-text addresses.
 */

/** Lowercase city / locality → canonical state key (lowercase). */
const CITY_TO_STATE: Record<string, string> = {
  bangalore: 'karnataka',
  bengaluru: 'karnataka',
  'electronic city': 'karnataka',
  'white field': 'karnataka',
  mumbai: 'maharashtra',
  pune: 'maharashtra',
  nagpur: 'maharashtra',
  delhi: 'delhi',
  noida: 'uttar pradesh',
  gurugram: 'haryana',
  gurgaon: 'haryana',
  hyderabad: 'telangana',
  secunderabad: 'telangana',
  chennai: 'tamil nadu',
  kolkata: 'west bengal',
  ahmedabad: 'gujarat',
  surat: 'gujarat',
  jaipur: 'rajasthan',
  indore: 'madhya pradesh',
  bhopal: 'madhya pradesh',
  kochi: 'kerala',
  thiruvananthapuram: 'kerala',
};

/** Lowercase state token → canonical state key. */
const STATE_ALIASES: Record<string, string> = {
  ka: 'karnataka',
  'k.a': 'karnataka',
  karnataka: 'karnataka',
  mh: 'maharashtra',
  maharashtra: 'maharashtra',
  dl: 'delhi',
  'nct delhi': 'delhi',
  delhi: 'delhi',
  tg: 'telangana',
  telangana: 'telangana',
  tn: 'tamil nadu',
  'tamil nadu': 'tamil nadu',
  'tamilnadu': 'tamil nadu',
  wb: 'west bengal',
  'west bengal': 'west bengal',
  gj: 'gujarat',
  gujarat: 'gujarat',
  rj: 'rajasthan',
  rajasthan: 'rajasthan',
  up: 'uttar pradesh',
  'uttar pradesh': 'uttar pradesh',
  hr: 'haryana',
  haryana: 'haryana',
  kl: 'kerala',
  kerala: 'kerala',
  mp: 'madhya pradesh',
  'madhya pradesh': 'madhya pradesh',
};

const DISPLAY_NAME: Record<string, string> = {
  'karnataka': 'Karnataka',
  'maharashtra': 'Maharashtra',
  'delhi': 'Delhi',
  'telangana': 'Telangana',
  'tamil nadu': 'Tamil Nadu',
  'west bengal': 'West Bengal',
  'gujarat': 'Gujarat',
  'rajasthan': 'Rajasthan',
  'uttar pradesh': 'Uttar Pradesh',
  'haryana': 'Haryana',
  'kerala': 'Kerala',
  'madhya pradesh': 'Madhya Pradesh',
};

function tokenKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Returns canonical lowercase state key for comparison, or undefined.
 */
export function resolveGstStateKey(state?: string, city?: string): string | undefined {
  const st = state?.trim();
  const ct = city?.trim();
  if (st) {
    const k = tokenKey(st);
    if (STATE_ALIASES[k] !== undefined) return STATE_ALIASES[k];
    if (CITY_TO_STATE[k] !== undefined) return CITY_TO_STATE[k];
    // Full state name not in alias map: normalize for equality (e.g. "Odisha")
    return k;
  }
  if (ct) {
    const k = tokenKey(ct);
    if (CITY_TO_STATE[k] !== undefined) return CITY_TO_STATE[k];
  }
  return undefined;
}

export function displayStateFromKey(key: string): string {
  return DISPLAY_NAME[key] || key.replace(/\b\w/g, (c) => c.toUpperCase());
}

export type GstSupplyClassification = 'intra_state' | 'inter_state' | 'unknown';

/**
 * Classify place of supply. Unknown is not inter-state — callers must fail closed
 * for service/package GST instead of silently charging IGST.
 */
export function classifyGstPlaceOfSupply(
  customerStateKey: string | undefined,
  vendorStateKey: string | undefined
): GstSupplyClassification {
  if (!customerStateKey || !vendorStateKey) return 'unknown';
  return customerStateKey === vendorStateKey ? 'intra_state' : 'inter_state';
}

/**
 * Inter-state supply → IGST. Intra-state (same normalized state key) → CGST + SGST.
 * Product/legacy callers still treat unknown as inter-state. Service and package
 * GST must use {@link classifyGstPlaceOfSupply} and fail closed on `unknown`
 * so a known same-state deal is never silently converted to IGST.
 */
export function isGstInterstateSupply(
  customerStateKey: string | undefined,
  vendorStateKey: string | undefined
): boolean {
  const kind = classifyGstPlaceOfSupply(customerStateKey, vendorStateKey);
  if (kind === 'unknown') return true;
  return kind === 'inter_state';
}

export class GstPlaceOfSupplyError extends Error {
  readonly code = 'GST_PLACE_OF_SUPPLY_UNKNOWN';
  constructor(message: string) {
    super(message);
    this.name = 'GstPlaceOfSupplyError';
  }
}

export function isGstPlaceOfSupplyError(err: unknown): err is GstPlaceOfSupplyError {
  return (
    err instanceof GstPlaceOfSupplyError ||
    (typeof err === 'object' &&
      err != null &&
      (err as { code?: string }).code === 'GST_PLACE_OF_SUPPLY_UNKNOWN')
  );
}

export function missingGstPlaceOfSupplyError(): GstPlaceOfSupplyError {
  return new GstPlaceOfSupplyError(
    'Unable to determine GST place of supply. Vendor and customer state are required to choose CGST+SGST or IGST.',
  );
}

/**
 * Build a GST location from stored vendor/customer fields.
 * Order: structured state/city columns, then JSON address, then plain-text inference.
 * Does not invent Karnataka from "Bangalore vendor" unless city/address actually maps.
 */
export function locationFromStoredFields(params: {
  state?: unknown;
  city?: unknown;
  address?: unknown;
}): { state?: string; city?: string } | undefined {
  const state = params.state != null ? String(params.state).trim() : '';
  const city = params.city != null ? String(params.city).trim() : '';
  if (state || city) {
    return { state: state || undefined, city: city || undefined };
  }

  const raw = params.address;
  if (raw == null || raw === '') return undefined;

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const st = o.state != null ? String(o.state).trim() : '';
    const ct = o.city != null ? String(o.city).trim() : '';
    if (st || ct) return { state: st || undefined, city: ct || undefined };
    return undefined;
  }

  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const st = parsed.state != null ? String(parsed.state).trim() : '';
        const ct = parsed.city != null ? String(parsed.city).trim() : '';
        if (st || ct) return { state: st || undefined, city: ct || undefined };
      }
    } catch {
      /* fall through to plain-text inference */
    }
  }
  const inferred = inferStateFromPlainAddressText(s);
  if (!inferred) return undefined;
  return {
    state: displayStateFromKey(inferred.stateKey),
    city: inferred.city,
  };
}

/** Infer state (and optional city) from a single free-text address line. */
export function inferStateFromPlainAddressText(text: string): { stateKey: string; city?: string } | null {
  const lower = text.toLowerCase();
  for (const [city, stateKey] of Object.entries(CITY_TO_STATE)) {
    if (lower.includes(city)) {
      return { stateKey, city: city.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') };
    }
  }
  for (const [alias, stateKey] of Object.entries(STATE_ALIASES)) {
    if (alias.length >= 4 && lower.includes(alias)) {
      return { stateKey };
    }
  }
  return null;
}
