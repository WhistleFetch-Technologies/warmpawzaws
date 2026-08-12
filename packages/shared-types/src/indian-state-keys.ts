/**
 * Indian state key normalization for intra- vs inter-state checks (delivery SLA, GST parity).
 * Keep aligned with backend/lambda/src/lib/gst-place-of-supply.ts
 */

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
  tamilnadu: 'tamil nadu',
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

function tokenKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Canonical lowercase state key for comparison, or undefined. */
export function resolveIndianStateKey(
  state?: string | null,
  city?: string | null,
): string | undefined {
  const st = state?.trim();
  const ct = city?.trim();
  if (st) {
    const k = tokenKey(st);
    if (STATE_ALIASES[k] !== undefined) return STATE_ALIASES[k];
    if (CITY_TO_STATE[k] !== undefined) return CITY_TO_STATE[k];
    return k;
  }
  if (ct) {
    const k = tokenKey(ct);
    if (CITY_TO_STATE[k] !== undefined) return CITY_TO_STATE[k];
  }
  return undefined;
}

/** Unknown state → inter-state (conservative). */
export function isInterstateIndianSupply(
  customerStateKey: string | undefined,
  vendorStateKey: string | undefined,
): boolean {
  if (!customerStateKey || !vendorStateKey) return true;
  return customerStateKey !== vendorStateKey;
}
