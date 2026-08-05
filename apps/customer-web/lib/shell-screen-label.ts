import { humanizeCustomerRouteScreen, buildCustomerRouteKey } from './route-screen-label';

/**
 * Human labels for CustomerHomeWrapper `currentScreen` values.
 * Unknown ids fall back to Title-Case from kebab-case.
 */
const SHELL_TITLE: Record<string, string> = {
  home: 'Dashboard',
  vet: 'Vet care',
  'vet-booking': 'Vet booking',
  'vet-doctor-details': 'Vet doctor',
  'vet-clinic-list': 'Clinic list',
  'vet-all-doctors': 'All veterinarians',
  'vet-clinic-profile': 'Clinic profile',
  'vet-clinic-booking': 'Clinic booking',
  'vet-services-by-style': 'Vet services',
  'tele-consultation-hub': 'Tele consultation',
  'vet-tele-consultation': 'Tele vet',
  'vet-home-visit': 'Home visit vet',
  'home-service-selection': 'Home Visit',
  grooming: 'Grooming',
  'grooming_center': 'Grooming center',
  'grooming_home': 'Grooming at home',
  'grooming-booking': 'Grooming booking',
  walker: 'Dog walker',
  'walker-booking': 'Walker booking',
  shop: 'Shop',
  product_detail: 'Product',
  cart: 'Cart',
  checkout: 'Checkout',
  bookings: 'Bookings',
  wallet: 'Wallet',
  profile: 'Profile',
  pharmacy_order_flow: 'Pharmacy order',
  problem_grid: 'Problem picker',
  services: 'Services',
};

function fallbackShellTitle(shellId: string): string {
  return shellId
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Readable name for a shell screen id (CustomerHomeWrapper `ScreenType`). */
export function shellScreenToTitle(shellId: string): string {
  return SHELL_TITLE[shellId] ?? fallbackShellTitle(shellId);
}

/** Admin-facing row title: route + in-app shell (e.g. `Home · Vet care`). */
export function composeShellAnalyticsLabel(pathname: string | null, queryString: string, shellId: string): string {
  const routeKey = buildCustomerRouteKey(pathname, queryString);
  const routeHuman = humanizeCustomerRouteScreen(routeKey);
  const shellHuman = shellScreenToTitle(shellId);
  return `${routeHuman} · ${shellHuman}`.slice(0, 512);
}
