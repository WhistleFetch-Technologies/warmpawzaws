/**
 * ============================================================================
 * HOME SERVICE CONSTANTS
 * ============================================================================
 * 
 * Constants for home service booking flows
 * No loose strings - all constants defined here
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

// Service Types
export const SERVICE_TYPES = {
  GROOMING: 'grooming',
  TRAINING: 'training',
  WALKER: 'walker',
  VET: 'vet',
} as const;

// Role IDs mapped to service types
export const SERVICE_TYPE_TO_ROLE = {
  [SERVICE_TYPES.GROOMING]: 'grooming_salon',
  [SERVICE_TYPES.TRAINING]: 'trainer',
  [SERVICE_TYPES.WALKER]: 'dog_walker',
  [SERVICE_TYPES.VET]: 'vet_clinic',
} as const;

// Booking Status Values
export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  VENDOR_EN_ROUTE: 'vendor_en_route', // For home services - vendor started journey
  VENDOR_ARRIVED: 'vendor_arrived', // For home services - vendor reached customer location
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

// Payment Status Values
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

// Service Style Values
export const SERVICE_STYLE = {
  AT_HOME: 'at_home',
  AT_CENTER: 'at_center',
  TELE: 'tele',
} as const;

// Default Values
export const DEFAULTS = {
  HOME_SERVICE_RADIUS_KM: 10,
  TRAVEL_TIME_PER_KM_MINUTES: 3,
  HOME_SERVICE_LEAD_TIME_MINUTES: 45,
  HOME_SERVICE_FEE: 0,
  COMMISSION_RATE_PERCENT: 15,
} as const;

// Endpoint Paths
export const ENDPOINTS = {
  BASE: '/make-server-3dd53475',
  DISCOVER: '/home-service/discover',
  BOOK: '/home-service/book',
  START_RIDE: '/home-service/:bookingId/start-ride',
  UPDATE_LOCATION: '/home-service/:bookingId/update-location',
  ARRIVED: '/home-service/:bookingId/arrived',
  PAYMENT_COMPLETE: '/home-service/:bookingId/payment-complete',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  MISSING_FIELDS: 'Missing required fields',
  BOOKING_NOT_FOUND: 'Booking not found',
  UNAUTHORIZED: 'Unauthorized',
  INVALID_STATUS: 'Booking not in confirmed state',
  GPS_NOT_ACTIVE: 'GPS tracking not active',
  VENDOR_NOT_FOUND: 'Vendor not found',
  FAILED_CREATE_BOOKING: 'Failed to create booking',
  FAILED_DISCOVER_PROVIDERS: 'Failed to discover providers',
  FAILED_START_TRACKING: 'Failed to start tracking',
  FAILED_UPDATE_LOCATION: 'Failed to update location',
  FAILED_MARK_ARRIVAL: 'Failed to mark arrival',
  FAILED_PROCESS_PAYMENT: 'Failed to process payment',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  BOOKING_CREATED: 'Booking created successfully. Please complete payment.',
  GPS_TRACKING_STARTED: 'GPS tracking started',
  VENDOR_ARRIVED: 'Vendor arrived. Ready for OTP verification.',
  PAYMENT_COMPLETED: 'Payment completed successfully',
} as const;

// Log Messages
export const LOG_MESSAGES = {
  DISCOVERY_START: (serviceType: string, lat: number, lng: number) => 
    `[HOME SERVICE] Discovery - ${serviceType} at ${lat}, ${lng}`,
  PROVIDERS_FOUND: (count: number) => 
    `✅ [HOME SERVICE] Found ${count} providers`,
  BOOKING_CREATED: (bookingId: string) => 
    `✅ [HOME SERVICE] Booking created: ${bookingId}`,
  GPS_TRACKING_STARTED: (trackingId: string) => 
    `✅ [GPS] Tracking started: ${trackingId}`,
  PAYMENT_COMPLETED: (bookingId: string, payout: number) => 
    `✅ [PAYMENT] Completed for booking ${bookingId} - Vendor payout: ₹${payout}`,
} as const;

