/**
 * Single source of truth for discovery, slots, and booking API parameter names and types.
 * Used by forensic trace scripts and backend handlers to ensure param matching end-to-end.
 * Do not use for MD documentation; code and runtime tracing only.
 */

/** Query params for GET /customer/discover-services */
export const DISCOVER_SERVICES_QUERY_PARAMS = {
  category: 'string (e.g. vet, grooming, walker, training)',
  roleId: 'string (role name or id)',
  serviceStyle: 'at_center | at_home | tele',
  latitude: 'number (string)',
  longitude: 'number (string)',
  limit: 'number (string)',
  offset: 'number (string)',
} as const;

/** Query params for GET /customer/vendor/:vendorId/available-slots */
export const AVAILABLE_SLOTS_QUERY_PARAMS = {
  date: 'YYYY-MM-DD',
  serviceStyle: 'at_center | at_home | tele',
  totalDuration: 'number (string, optional)',
  serviceIds: 'string (comma-separated, optional)',
  staffId: 'string (optional)',
  serviceId: 'string (optional)',
} as const;

/** Body params for POST /bookings/create (camelCase) */
export const BOOKING_CREATE_BODY_PARAMS = {
  customerId: 'string (UUID)',
  vendorId: 'string (UUID, resolved to canonical vendors.id)',
  serviceId: 'string (UUID or diagnostics)',
  bookingDate: 'YYYY-MM-DD',
  bookingTime: 'HH:MM or HH:MM:SS',
  serviceType: 'at_center | at_home | tele | at_vendor | etc.',
  staffId: 'string (optional)',
  address: 'string | object (optional)',
  petId: 'string (optional)',
  amount: 'number (optional)',
  idempotencyKey: 'string (optional)',
  selectedServices: 'array (optional)',
  customerPhone: 'string (optional)',
  customerName: 'string (optional)',
  petName: 'string (optional)',
  notes: 'string (optional)',
} as const;

/** Response fields for available-slots (camelCase) */
export const AVAILABLE_SLOTS_RESPONSE_FIELDS = {
  success: 'boolean',
  slots: 'array',
  date: 'YYYY-MM-DD',
  vendorId: 'string (canonical vendors.id)',
  vendorIdentityId: 'string | undefined',
  serviceStyle: 'string',
  staffBased: 'boolean',
  message: 'string (optional)',
} as const;
