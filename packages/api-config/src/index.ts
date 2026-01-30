/**
 * @warmpawz/api-config
 * Single repo: warmpawzecodev – API base URL and endpoint path constants.
 * All apps (admin-web, vendor-web, customer-web, WarmpawzVendor RN, Warmpawz Ecosystem Development)
 * should use this or align to these paths. Backend: backend/lambda (API Gateway).
 */

/** Default API base (API Gateway). Override via env in each app. */
const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.VITE_API_BASE_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

/**
 * Get API base URL (no trailing slash).
 * Browser apps: use runtime-config.js or NEXT_PUBLIC_* / VITE_*.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && (window as any).__WARMPAWZ_RUNTIME_CONFIG__?.apiBaseUrl) {
    return ((window as any).__WARMPAWZ_RUNTIME_CONFIG__.apiBaseUrl as string).replace(/\/+$/, '');
  }
  return DEFAULT_API_BASE.replace(/\/+$/, '');
}

/** Endpoint path constants (backend/lambda). Use with getApiBaseUrl() + path. */
export const ENDPOINTS = {
  // Config & roles (vendor onboarding, choose role)
  CONFIG_ROLES: '/config/roles',
  CONFIG_ROLE: (roleId: string) => `/config/roles/${roleId}`,
  ADMIN_ROLES: '/admin/roles',

  // Vendor
  VENDOR_STATUS: (phone: string) => `/vendor/status/${phone}`,
  VENDOR_FIND_BY_PHONE: (phone: string) => `/vendor/find-by-phone/${phone}`,
  VENDOR_APPLICATION: '/vendor/application',
  ADMIN_VENDORS_ACTIVE: '/admin/vendors/active',
  ADMIN_VENDOR_MIGRATE: (phone: string) => `/admin/vendor/migrate/${phone}`,

  // Auth (if used from backend)
  AUTH_OTP_SEND: '/auth/otp/send',
  AUTH_OTP_VERIFY: '/auth/otp/verify',

  // Customer
  CUSTOMER_SERVICES: '/customer/services',
  CUSTOMER_PROFILE: (phone: string) => `/customer/profile/${phone}`,
  CUSTOMER_PETS: (phone: string) => `/customer/pets/${phone}`,
  CUSTOMER_BOOKINGS: (phone: string) => `/customer/${phone}/bookings`,

  // Booking
  BOOKING: (id: string) => `/booking/${id}`,
} as const;

export default { getApiBaseUrl, ENDPOINTS };
