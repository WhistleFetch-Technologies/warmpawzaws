/**
 * Vendor-web feature toggles. Flip to `true` when a capability is ready for production.
 * Prefer importing `VENDOR_FEATURE_FLAGS` so call sites stay consistent.
 */
export const VENDOR_FEATURE_FLAGS = {
  /** Emergency on-call / SOS availability for vet & ambulance flows (bookings UI). */
  emergencyAvailabilitySos: false,
} as const;
