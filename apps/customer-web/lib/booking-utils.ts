/**
 * Booking Utilities
 * 
 * Centralized validation and helper functions for booking flows
 * Prevents code duplication and ensures consistency
 */

/**
 * Validates if a string is a valid UUID v4
 */
export function isValidUUID(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validates service ID is not a service type/style
 */
export function isValidServiceId(serviceId: string): boolean {
  if (!serviceId || typeof serviceId !== 'string') return false;
  
  const invalidValues = [
    'at_center', 'at_home', 'tele', 'at_vendor', 'online', 
    'hybrid', 'product', 'clinic', 'home'
  ];
  
  if (invalidValues.includes(serviceId.toLowerCase())) {
    return false;
  }
  
  return isValidUUID(serviceId);
}

/**
 * Normalizes service style from various formats
 */
export function normalizeServiceStyle(style?: string, type?: string): string | null {
  if (style) {
    const normalized = style.toLowerCase();
    if (['tele', 'at_home', 'at_center'].includes(normalized)) {
      return normalized;
    }
  }
  
  if (type) {
    const typeMap: Record<string, string> = {
      'clinic': 'at_center',
      'home': 'at_home',
      'tele': 'tele'
    };
    return typeMap[type.toLowerCase()] || null;
  }
  
  return null;
}

/**
 * Validates booking date format
 */
export function isValidBookingDate(date: string): boolean {
  if (!date || typeof date !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * Validates booking time format
 */
export function isValidBookingTime(time: string): boolean {
  if (!time || typeof time !== 'string') return false;
  return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

/**
 * Validates coordinates
 */
export function isValidCoordinates(lat?: number, lng?: number): boolean {
  if (lat === undefined || lng === undefined) return true; // Optional
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Extracts user-friendly error message from API error
 */
export const SLOT_CONFLICT_USER_MESSAGE =
  'This time slot is already booked. Please select a different time.';

export function isSlotConflictError(error: any): boolean {
  const errorData = error?.response?.data || error?.data || error?.response || error;
  const code =
    errorData?.code ||
    errorData?.error?.code ||
    error?.code;
  if (code === 'SLOT_CONFLICT') return true;
  const status = error?.statusCode ?? error?.status ?? errorData?.status;
  const message = String(
    errorData?.error?.message ||
      errorData?.error ||
      errorData?.message ||
      error?.message ||
      ''
  );
  if (status === 409 && /slot|already booked|unavailable/i.test(message)) return true;
  if (message.includes('SLOT_CONFLICT') || /already booked/i.test(message)) return true;
  return false;
}
export function extractErrorMessage(error: any): string {
  const errorData = error?.response?.data || error?.data;
  
  // Handle validation errors
  if (errorData?.data?.errors && Array.isArray(errorData.data.errors)) {
    const messages = errorData.data.errors
      .map((e: any) => {
        const path = e.path?.join('.') || e.path || 'field';
        return `${path}: ${e.message}`;
      })
      .join(', ');
    return `Please check: ${messages}`;
  }
  
  if (errorData?.errors && Array.isArray(errorData.errors)) {
    const messages = errorData.errors
      .map((e: any) => e.message || String(e))
      .join(', ');
    return `Please check: ${messages}`;
  }
  
  // Handle specific error codes
  if (isSlotConflictError(error)) {
    return SLOT_CONFLICT_USER_MESSAGE;
  }
  
  if (error?.statusCode === 409 || error?.status === 409) {
    return 'This booking already exists or time slot is unavailable.';
  }
  
  if (error?.statusCode === 404 || error?.status === 404) {
    return 'Service not found. Please try selecting again.';
  }
  
  // Return user-friendly message
  return errorData?.error || 
         errorData?.message || 
         error?.message || 
         'Something went wrong. Please try again.';
}

/**
 * Validates complete booking data before creation
 */
export interface BookingValidationResult {
  isValid: boolean;
  errors: string[];
  validatedData?: any;
}

export function validateBookingData(data: {
  customerId?: string;
  vendorId?: string;
  serviceId?: string;
  bookingDate?: string;
  bookingTime?: string;
  selectedPet?: any;
  selectedServiceType?: string;
  selectedAddress?: any;
}): BookingValidationResult {
  const errors: string[] = [];
  
  // Validate customer ID
  if (!data.customerId) {
    errors.push('Customer ID is required');
  } else if (!isValidUUID(data.customerId)) {
    errors.push('Invalid customer ID format');
  }
  
  // Validate vendor ID
  if (!data.vendorId) {
    errors.push('Vendor ID is required');
  } else if (!isValidUUID(data.vendorId)) {
    errors.push('Invalid vendor ID format');
  }
  
  // Validate service ID
  if (!data.serviceId) {
    errors.push('Service ID is required');
  } else if (!isValidServiceId(data.serviceId)) {
    errors.push('Invalid service ID. Please select a valid service.');
  }
  
  // Validate date
  if (!data.bookingDate) {
    errors.push('Booking date is required');
  } else if (!isValidBookingDate(data.bookingDate)) {
    errors.push('Invalid date format');
  }
  
  // Validate time
  if (!data.bookingTime) {
    errors.push('Booking time is required');
  } else if (!isValidBookingTime(data.bookingTime)) {
    errors.push('Invalid time format');
  }
  
  // Validate pet for non-tele services (if required)
  if (data.selectedServiceType !== 'tele' && !data.selectedPet?.id) {
    errors.push('Pet selection is required');
  }
  
  // Validate address for home services
  if (data.selectedServiceType === 'at_home') {
    if (!data.selectedAddress) {
      errors.push('Address is required for home services');
    } else if (!data.selectedAddress.address && !data.selectedAddress.addressLine1) {
      errors.push('Valid address is required');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    validatedData: errors.length === 0 ? data : undefined
  };
}
