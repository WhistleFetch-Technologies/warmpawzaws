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

/**
 * Inter-state supply → IGST. Intra-state (same normalized state key) → CGST + SGST.
 * If either place of supply is unknown, defaults to inter-state (IGST) — conservative compliance fallback.
 */
export function isGstInterstateSupply(
  customerStateKey: string | undefined,
  vendorStateKey: string | undefined
): boolean {
  if (!customerStateKey || !vendorStateKey) return true;
  return customerStateKey !== vendorStateKey;
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
