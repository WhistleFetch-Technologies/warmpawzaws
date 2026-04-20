/**
 * Maps wizard / search category strings to API query defaults and UniversalPaymentPage props.
 */

export type WizardCategory =
  | 'vet'
  | 'grooming'
  | 'training'
  | 'boarding'
  | 'walker'
  | 'walking'
  | 'pharmacy'
  | 'cafe'
  | 'resort'
  | 'nutrition'
  | 'sitting';

const CATEGORY_SET = new Set<string>([
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

export function normalizeWizardCategory(raw: string | null | undefined): WizardCategory {
  const s = String(raw || 'vet')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_');
  if (s === 'walk') return 'walker';
  if (CATEGORY_SET.has(s)) return s as WizardCategory;
  return 'vet';
}

/** Default in-clinic / center style for widget slot calls when the catalog row has no style yet. */
export function defaultServiceStyleForCategory(category: WizardCategory): 'at_center' | 'at_home' | 'tele' {
  if (category === 'walker' || category === 'walking' || category === 'sitting') return 'at_home';
  return 'at_center';
}

/** Canonical visit types used by vendor_services rows and slot APIs. */
export type BookingServiceStyleKey = 'at_center' | 'at_home' | 'tele';

/**
 * Map DB / API service_style values to a booking key (align with customer vendor services SQL).
 * Unknown or empty values default to at_center so legacy rows still surface.
 */
export function normalizeVendorServiceStyleToBookingKey(
  raw: string | null | undefined
): BookingServiceStyleKey {
  const n = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/-/g, '_')
    .replace(/\s+/g, '_');
  const map: Record<string, BookingServiceStyleKey> = {
    at_clinic: 'at_center',
    at_vendor: 'at_center',
    at_center: 'at_center',
    center: 'at_center',
    clinic: 'at_center',
    home_visit: 'at_home',
    at_home: 'at_home',
    home: 'at_home',
    video_consultation: 'tele',
    online: 'tele',
    tele: 'tele',
    video: 'tele',
  };
  return map[n] || 'at_center';
}

/** Distinct visit types present in a vendor service list (order: center → home → tele). */
export function distinctBookingStyleKeysFromServices(services: unknown[]): BookingServiceStyleKey[] {
  if (!Array.isArray(services)) return [];
  const set = new Set<BookingServiceStyleKey>();
  for (const s of services) {
    const row = s as { serviceStyle?: string; service_style?: string };
    const raw = row.serviceStyle ?? row.service_style;
    set.add(normalizeVendorServiceStyleToBookingKey(raw));
  }
  const order: BookingServiceStyleKey[] = ['at_center', 'at_home', 'tele'];
  return order.filter((k) => set.has(k));
}

export function servicesFilteredByBookingStyleKey(
  services: unknown[],
  key: BookingServiceStyleKey
): any[] {
  if (!Array.isArray(services)) return [];
  return services.filter(
    (s) =>
      normalizeVendorServiceStyleToBookingKey(
        (s as { serviceStyle?: string; service_style?: string }).serviceStyle ??
          (s as { service_style?: string }).service_style
      ) === key
  );
}

export function bookingServiceStyleShortLabel(key: BookingServiceStyleKey): string {
  if (key === 'at_center') return 'Clinic / center';
  if (key === 'at_home') return 'Home visit';
  return 'Video / tele';
}

/** `category` query for GET /customer/vendor/:id/services */
export function vendorServicesQuery(category: WizardCategory, serviceStyle?: string): string {
  const normalized = normalizeWizardCategory(category);
  const apiCat =
    normalized === 'walker' || normalized === 'walking' ? 'walking' : normalized;
  const params = new URLSearchParams();
  params.set('category', apiCat);
  params.set('serviceStyle', serviceStyle || defaultServiceStyleForCategory(normalized));
  return `?${params.toString()}`;
}

/** All published services for the category (any service_style); client filters by visit type. */
export function vendorServicesQueryAllStyles(category: WizardCategory): string {
  const normalized = normalizeWizardCategory(category);
  const apiCat =
    normalized === 'walker' || normalized === 'walking' ? 'walking' : normalized;
  const params = new URLSearchParams();
  params.set('category', apiCat);
  params.set('serviceStyle', 'all');
  return `?${params.toString()}`;
}

/** UniversalPaymentPage `category` prop (promotions / spotlights). */
export function paymentCategoryLabel(category: WizardCategory): string {
  if (category === 'walking') return 'walker';
  return category;
}
