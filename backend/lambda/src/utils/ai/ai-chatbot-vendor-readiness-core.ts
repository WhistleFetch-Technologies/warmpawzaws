/**
 * Pure vendor readiness messages (no DB import — safe for unit tests).
 */

/**
 * Single predicate for "slot counts as on".
 * Schedule saves (vendor-schedule) primarily set **is_enabled**; some schemas also have is_available/is_active.
 * COALESCE must prefer **is_enabled before is_available**, otherwise is_available=false with is_enabled=true
 * incorrectly marks the row as off.
 */
export function buildVendorAvailabilityV2OpenPredicateSql(cols: Set<string>): string {
  const chain = ['is_enabled', 'is_available', 'is_active'].filter((c) => cols.has(c));
  if (chain.length === 0) return 'true';
  const args = chain.map((c) => `va.${c}`).join(', ');
  return `COALESCE(${args}, true) = true`;
}

export type VendorReadinessInputs = {
  status: unknown;
  isActive: unknown;
  isOnline: unknown;
  latitude: unknown;
  longitude: unknown;
  businessName: unknown;
  publishedForDiscoveryServices: number;
  availabilityTotalRows: number;
  availabilityOpenRows: number;
};

function truthyOnline(isOnline: unknown): boolean {
  if (isOnline === false || isOnline === 'f' || isOnline === 'false' || isOnline === 0 || isOnline === '0') {
    return false;
  }
  return true;
}

function isActiveVendor(isActive: unknown): boolean {
  if (isActive === false || isActive === 'f' || isActive === 'false' || isActive === 0) return false;
  return true;
}

function hasCoords(lat: unknown, lng: unknown): boolean {
  if (lat == null || lng == null) return false;
  const ls = String(lat).trim();
  const gs = String(lng).trim();
  return ls !== '' && gs !== '';
}

function hasBusinessDisplayName(businessName: unknown): boolean {
  return typeof businessName === 'string' && businessName.trim().length > 0;
}

export function computeVendorReadinessMessages(i: VendorReadinessInputs): string[] {
  const st = String(i.status ?? '').trim().toLowerCase();
  /** Align with customer discovery: many live vendors use status "active" after onboarding. */
  const discoveryStatusOk = st === 'approved' || st === 'active';
  const gaps: string[] = [];

  if (!discoveryStatusOk) {
    gaps.push(
      `Account listing status is "${String(i.status ?? 'unknown')}" — customer discovery usually expects approved or active. If you are still onboarding, finish approval in the app.`
    );
  }
  if (!isActiveVendor(i.isActive)) {
    gaps.push('Account is marked inactive — enable the vendor account where your app exposes active/on vacation controls.');
  }
  if (!truthyOnline(i.isOnline)) {
    gaps.push('You are marked offline — use the in-app online toggle so customers are not filtered out.');
  }
  if (!hasBusinessDisplayName(i.businessName)) {
    gaps.push('Business / display name is empty — set it on your vendor profile (customer cards need a name).');
  }
  if (!hasCoords(i.latitude, i.longitude)) {
    gaps.push('Map location is missing — complete address / pin on map so nearby search can include you.');
  }
  if (i.publishedForDiscoveryServices < 1) {
    gaps.push(
      'No enabled + published services — add or enable services and publish (published or auto_published) so you appear in customer browse/search.'
    );
  }
  if (i.availabilityTotalRows < 1) {
    gaps.push(
      'No saved schedule slots found in the system for your account — open Scheduling and add weekly hours per service type so customers can see bookable times.'
    );
  } else if (i.availabilityOpenRows < 1) {
    gaps.push(
      'Schedule data exists but nothing is turned on for booking — in Scheduling, enable at least one time window per service you offer.'
    );
  }

  const header =
    gaps.length === 0
      ? 'Summary: Core customer-discovery checks pass (approval, active, online, display name, map pin, published service, availability windows).'
      : `Summary: ${gaps.length} gap(s) below may limit how you appear in the customer app or search until fixed.`;

  return [header, ...gaps.map((g) => `- ${g}`)];
}

export function formatVendorReadinessSection(lines: string[]): string {
  if (!lines.length) return '';
  const body = lines.join('\n').slice(0, 2200);
  return `VENDOR CUSTOMER VISIBILITY (read-only DB snapshot — use to explain what is missing; app labels may say Services / Scheduling / Settings):\n${body}\n`;
}
