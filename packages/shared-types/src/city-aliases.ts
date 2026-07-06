/**
 * City alias map for India — canonical name → list of known aliases.
 *
 * ALL city name strings must live here and nowhere else.
 * Business logic must call resolveCityToCanonical() and never match strings directly.
 *
 * Canonical names are lowercase. Aliases are lowercase.
 * To add a new alias: append to the relevant array and redeploy.
 */
export const CITY_ALIAS_MAP: Record<string, string[]> = {
  bengaluru: [
    'bangalore',
    'bangalore urban',
    'bengaluru urban',
    'blr',
    'bangaluru',
    'banglore',
    'bengalore',
    'bangalor',
  ],
  mumbai: [
    'bombay',
    'mumbai suburban',
    'greater mumbai',
    'bom',
  ],
  kolkata: [
    'calcutta',
    'calcutta metropolitan',
    'cal',
    'howrah',
  ],
  chennai: [
    'madras',
    'maa',
  ],
  delhi: [
    'new delhi',
    'delhi ncr',
    'ncr delhi',
    'ncr',
    'new delhi ncr',
  ],
  hyderabad: [
    'cyberabad',
    'secunderabad',
    'hyd',
  ],
  pune: [
    'poona',
    'pnq',
  ],
  ahmedabad: [
    'amdavad',
    'ahmadabad',
    'ahemdabad',
    'amd',
  ],
  thiruvananthapuram: [
    'trivandrum',
    'tvm',
  ],
  kochi: [
    'cochin',
    'ernakulam',
    'cok',
  ],
  vadodara: [
    'baroda',
    'brc',
  ],
  varanasi: [
    'banaras',
    'benares',
    'kashi',
    'vns',
  ],
  prayagraj: [
    'allahabad',
  ],
  mysuru: [
    'mysore',
    'mys',
  ],
  bengaluru_rural: [
    'bangalore rural',
    'bengaluru rural',
  ],
  gurugram: [
    'gurgaon',
    'dlf city',
  ],
  faridabad: [
    'ballabhgarh',
  ],
  noida: [
    'greater noida',
    'noida extension',
  ],
  ghaziabad: [
    'gzb',
  ],
  navi_mumbai: [
    'navi mumbai',
    'navimumbai',
    'new mumbai',
    'cbd belapur',
  ],
  thane: [
    'thane district',
  ],
  nagpur: [
    'ngp',
  ],
  nashik: [
    'nasik',
  ],
  surat: [
    'srt',
  ],
  jaipur: [
    'jaipure',
    'jpr',
  ],
  lucknow: [
    'lko',
  ],
  patna: [
    'pat',
  ],
  bhubaneswar: [
    'bhubaneshwar',
    'bhuvaneshwar',
    'bbsr',
  ],
  visakhapatnam: [
    'vizag',
    'vishakhapatnam',
    'vishakapatnam',
    'vsk',
  ],
  coimbatore: [
    'kovai',
    'cbe',
  ],
  madurai: [
    'mdu',
  ],
  tiruchirappalli: [
    'trichy',
    'tiruchi',
  ],
  thiruvannamalai: [
    'tiruvannamalai',
  ],
  vijayawada: [
    'vijayavada',
    'bezawada',
    'vja',
  ],
  amritsar: [
    'asr',
  ],
  chandigarh: [
    'tricity',
  ],
  dehradun: [
    'doon',
    'ddn',
  ],
  indore: [
    'idr',
  ],
  bhopal: [
    'bpl',
  ],
  guwahati: [
    'gauhati',
    'gwl',
  ],
  ranchi: [
    'rnc',
  ],
  jodhpur: [
    'jdh',
  ],
  kota: [
    'kota rajasthan',
  ],
  agra: [
    'agr',
  ],
  kanpur: [
    'cawnpore',
    'knp',
  ],
  meerut: [
    'mrt',
  ],
  ludhiana: [
    'ldh',
  ],
  jalandhar: [
    'jullundur',
    'jlr',
  ],
  kolhapur: [
    'kop',
  ],
  aurangabad: [
    'chhatrapati sambhajinagar',
    'aur',
  ],
  solapur: [
    'sholapur',
    'slp',
  ],
  mangaluru: [
    'mangalore',
    'mlr',
  ],
  hubballi: [
    'hubli',
    'hubli dharwad',
  ],
  belagavi: [
    'belgaum',
    'bgm',
  ],
  davangere: [
    'davengere',
    'dvg',
  ],
  shivamogga: [
    'shimoga',
    'smg',
  ],
  tumakuru: [
    'tumkur',
    'tmk',
  ],
  udupi: [
    'udipi',
  ],
  thrissur: [
    'trichur',
  ],
  kozhikode: [
    'calicut',
    'ccj',
  ],
  kollam: [
    'quilon',
  ],
  alappuzha: [
    'alleppey',
  ],
  palakkad: [
    'palghat',
  ],
  kannur: [
    'cannanore',
  ],
  puducherry: [
    'pondicherry',
    'pondy',
    'pdy',
  ],
  salem: [
    'slm',
  ],
  tirunelveli: [
    'nellai',
    'tvl',
  ],
  erode: [
    'erd',
  ],
  vellore: [
    'vlr',
  ],
  thoothukudi: [
    'tuticorin',
    'tut',
  ],
};

/**
 * Flat reverse map: alias → canonical name.
 * Built once at module load; used by resolveCityToCanonical.
 */
const ALIAS_TO_CANONICAL: Map<string, string> = new Map();
for (const [canonical, aliases] of Object.entries(CITY_ALIAS_MAP)) {
  // The canonical itself resolves to itself (normalised key → canonical).
  ALIAS_TO_CANONICAL.set(canonical.replace(/_/g, ' '), canonical.replace(/_/g, ' '));
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL.set(alias, canonical.replace(/_/g, ' '));
  }
}

/**
 * Normalise a city string to its canonical lowercase form.
 * Lowercases, trims, collapses whitespace, then looks up in alias map.
 * Returns the canonical form if found, otherwise the normalised input as-is.
 */
export function resolveCityToCanonical(city: string): string {
  const norm = String(city ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return ALIAS_TO_CANONICAL.get(norm) ?? norm;
}

/**
 * Sorted list of canonical city names for autocomplete datalists.
 * Includes display-friendly capitalised labels alongside raw values.
 */
export const KNOWN_CANONICAL_CITIES: readonly string[] = Object.keys(CITY_ALIAS_MAP)
  .map((k) => k.replace(/_/g, ' '))
  .sort();

/**
 * Human-readable display name: capitalises each word.
 * e.g. "bengaluru" → "Bengaluru"
 */
export function displayCityName(canonical: string): string {
  return canonical
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
