/**
 * ============================================================================
 * BOOKING SERVICE - BUSINESS LOGIC LAYER
 * ============================================================================
 * 
 * Functional model for booking management capabilities
 * Contains pure business logic for booking operations
 * 
 * Capabilities: booking_create, booking_view
 * ============================================================================
 */

import { isValidUUID } from '../../types/entities';

export interface BookingData {
  customerId: string;
  vendorId: string;
  serviceId: string;
  petId?: string;
  staffId?: string;
  bookingDate: string;
  bookingTime: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  address?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface BookingStatusUpdate {
  bookingId: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'declined';
  reason?: string;
}

export interface BookingValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates booking data according to business rules
 */
export function validateBooking(data: BookingData): BookingValidationResult {
  const errors: string[] = [];

  // Customer ID validation
  if (!data.customerId || !isValidUUID(data.customerId)) {
    errors.push('Valid customerId is required');
  }

  // Vendor ID validation
  if (!data.vendorId || !isValidUUID(data.vendorId)) {
    errors.push('Valid vendorId is required');
  }

  // Service ID validation
  if (!data.serviceId || !isValidUUID(data.serviceId)) {
    errors.push('Valid serviceId is required');
  }

  // Booking date validation
  if (!data.bookingDate) {
    errors.push('Booking date is required');
  } else {
    const bookingDate = new Date(data.bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(bookingDate.getTime())) {
      errors.push('Booking date must be a valid date');
    } else if (bookingDate < today) {
      errors.push('Booking date cannot be in the past');
    }
  }

  // Booking time validation
  if (!data.bookingTime) {
    errors.push('Booking time is required');
  } else {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(data.bookingTime)) {
      errors.push('Booking time must be in HH:mm format (24-hour)');
    }
  }

  // Service style validation
  if (!data.serviceStyle || !['at_home', 'at_center', 'tele'].includes(data.serviceStyle)) {
    errors.push('Service style must be one of: at_home, at_center, tele');
  }

  // Address validation (required for at_home)
  if (data.serviceStyle === 'at_home') {
    if (!data.address || data.address.trim().length === 0) {
      errors.push('Address is required for at_home service');
    }
    if (!data.latitude || !data.longitude) {
      errors.push('Latitude and longitude are required for at_home service');
    }
  }

  // Coordinates validation
  if (data.latitude !== undefined) {
    if (data.latitude < -90 || data.latitude > 90) {
      errors.push('Latitude must be between -90 and 90');
    }
  }

  if (data.longitude !== undefined) {
    if (data.longitude < -180 || data.longitude > 180) {
      errors.push('Longitude must be between -180 and 180');
    }
  }

  // Pet ID validation (optional but must be valid if provided)
  if (data.petId && !isValidUUID(data.petId)) {
    errors.push('petId must be a valid UUID if provided');
  }

  // Staff ID validation (optional but must be valid if provided)
  if (data.staffId && !isValidUUID(data.staffId)) {
    errors.push('staffId must be a valid UUID if provided');
  }

  // Notes validation
  if (data.notes && data.notes.length > 1000) {
    errors.push('Notes exceed 1000 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates booking status update
 */
export function validateBookingStatusUpdate(data: BookingStatusUpdate): BookingValidationResult {
  const errors: string[] = [];

  // Booking ID validation
  if (!data.bookingId || !isValidUUID(data.bookingId)) {
    errors.push('Valid bookingId is required');
  }

  // Status validation
  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'declined'];
  if (!data.status || !validStatuses.includes(data.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  // Reason validation (required for declined/cancelled)
  if ((data.status === 'declined' || data.status === 'cancelled') && !data.reason) {
    errors.push('Reason is required for declined or cancelled bookings');
  }

  if (data.reason && data.reason.length > 500) {
    errors.push('Reason exceeds 500 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Normalizes booking data for database storage
 */
export function normalizeBookingData(data: BookingData): any {
  const normalized: any = {
    customer_id: data.customerId,
    vendor_id: data.vendorId,
    service_id: data.serviceId,
    booking_date: data.bookingDate,
    booking_time: data.bookingTime,
    service_style: data.serviceStyle,
    status: 'pending', // Default status
  };

  if (data.petId) {
    normalized.pet_id = data.petId;
  }

  if (data.staffId) {
    normalized.staff_id = data.staffId;
  }

  if (data.address) {
    normalized.address = data.address.trim();
  }

  if (data.latitude !== undefined) {
    normalized.latitude = data.latitude;
  }

  if (data.longitude !== undefined) {
    normalized.longitude = data.longitude;
  }

  if (data.notes) {
    normalized.notes = data.notes.trim();
  }

  return normalized;
}

/**
 * Formats booking for API response
 */
export function formatBookingResponse(booking: any): any {
  return {
    id: booking.id,
    customerId: booking.customer_id,
    vendorId: booking.vendor_id,
    serviceId: booking.service_id,
    petId: booking.pet_id,
    staffId: booking.staff_id,
    bookingDate: booking.booking_date,
    bookingTime: booking.booking_time,
    serviceStyle: booking.service_style,
    status: booking.status,
    address: booking.address,
    latitude: booking.latitude,
    longitude: booking.longitude,
    notes: booking.notes,
    createdAt: booking.created_at,
    updatedAt: booking.updated_at,
  };
}

/**
 * Checks if booking can be cancelled (business rule)
 */
export function canCancelBooking(booking: any): boolean {
  // Business rule: Only pending or confirmed bookings can be cancelled
  return ['pending', 'confirmed'].includes(booking.status);
}

/**
 * Checks if booking can be completed (business rule)
 */
export function canCompleteBooking(booking: any): boolean {
  // Business rule: Only in_progress bookings can be completed
  return booking.status === 'in_progress';
}

/**
 * Validates booking time slot availability (business rule)
 */
export function validateBookingTimeSlot(
  bookingDate: string,
  bookingTime: string,
  existingBookings: any[]
): BookingValidationResult {
  const errors: string[] = [];

  const requestedDateTime = new Date(`${bookingDate}T${bookingTime}`);

  // Check for conflicts with existing bookings
  for (const existing of existingBookings) {
    const existingDateTime = new Date(`${existing.booking_date}T${existing.booking_time}`);

    // Business rule: Minimum 30 minutes gap between bookings
    const timeDiff = Math.abs(requestedDateTime.getTime() - existingDateTime.getTime());
    const minutesDiff = timeDiff / (1000 * 60);

    if (minutesDiff < 30 && existing.status !== 'cancelled' && existing.status !== 'declined') {
      errors.push(
        `Booking time conflicts with existing booking. Minimum 30 minutes gap required.`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculates booking duration based on service (business rule)
 */
export function calculateBookingDuration(serviceDuration: number, serviceStyle: string): number {
  // Business rule: Add buffer time based on service style
  let bufferMinutes = 0;

  if (serviceStyle === 'at_home') {
    bufferMinutes = 15; // Travel time buffer
  } else if (serviceStyle === 'tele') {
    bufferMinutes = 5; // Connection setup buffer
  }

  return serviceDuration + bufferMinutes;
}
