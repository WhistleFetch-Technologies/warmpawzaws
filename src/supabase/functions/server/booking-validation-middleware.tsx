/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║           BOOKING VALIDATION MIDDLEWARE - PRODUCTION GRADE                 ║
 * ║                    Enterprise-Ready Validation                             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import type { BookingRecord, RefundCalculation } from './db-schema-documentation.tsx';

/**
 * Validation Result Interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Phone Number Validation
 */
export function validatePhone(phone: string): ValidationResult {
  const errors: string[] = [];
  
  if (!phone) {
    errors.push('Phone number is required');
    return { isValid: false, errors };
  }
  
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  
  if (cleanPhone.length !== 10) {
    errors.push('Phone number must be exactly 10 digits');
  }
  
  if (!/^[6-9]/.test(cleanPhone)) {
    errors.push('Phone number must start with 6, 7, 8, or 9');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Email Validation
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (!email) {
    errors.push('Email is required');
    return { isValid: false, errors };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Date Validation
 */
export function validateDate(dateStr: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!dateStr) {
    errors.push('Date is required');
    return { isValid: false, errors };
  }
  
  // Check format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    errors.push('Date must be in YYYY-MM-DD format');
    return { isValid: false, errors };
  }
  
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (isNaN(date.getTime())) {
    errors.push('Invalid date');
  }
  
  if (date < today) {
    errors.push('Date cannot be in the past');
  }
  
  // Warning for dates too far in future (>90 days)
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 90);
  if (date > maxDate) {
    warnings.push('Date is more than 90 days in the future');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Time Validation
 */
export function validateTime(timeStr: string): ValidationResult {
  const errors: string[] = [];
  
  if (!timeStr) {
    errors.push('Time is required');
    return { isValid: false, errors };
  }
  
  // Accept both 12-hour (HH:MM AM/PM) and 24-hour (HH:MM) formats
  const time12Regex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i;
  const time24Regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  
  if (!time12Regex.test(timeStr) && !time24Regex.test(timeStr)) {
    errors.push('Time must be in HH:MM AM/PM or HH:MM format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Amount Validation
 */
export function validateAmount(amount: number, min: number = 0, max: number = 1000000): ValidationResult {
  const errors: string[] = [];
  
  if (amount === undefined || amount === null) {
    errors.push('Amount is required');
    return { isValid: false, errors };
  }
  
  if (typeof amount !== 'number' || isNaN(amount)) {
    errors.push('Amount must be a valid number');
  }
  
  if (amount < min) {
    errors.push(`Amount must be at least ₹${min}`);
  }
  
  if (amount > max) {
    errors.push(`Amount cannot exceed ₹${max}`);
  }
  
  if (amount % 1 !== 0) {
    errors.push('Amount must be a whole number (no decimals)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * OTP Validation
 */
export function validateOTP(otp: string): ValidationResult {
  const errors: string[] = [];
  
  if (!otp) {
    errors.push('OTP is required');
    return { isValid: false, errors };
  }
  
  if (!/^\d{4}$/.test(otp)) {
    errors.push('OTP must be exactly 4 digits');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Role ID Validation
 */
export function validateRoleId(roleId: string): ValidationResult {
  const errors: string[] = [];
  
  if (!roleId) {
    errors.push('Role ID is required');
    return { isValid: false, errors };
  }
  
  const validRoles = [
    'veterinarian',
    'role_veterinarian',
    'vet_clinic',
    'role_vet_clinic',
    'pet_clinic',
    'role_pet_clinic',
    'groomer',
    'role_groomer',
    'grooming_center',
    'role_grooming_center',
    'trainer',
    'role_trainer',
    'training_center',
    'role_training_center',
    'walker',
    'role_walker',
    'behaviourist',
    'role_behaviourist',
    'behavioral_trainer',
    'role_behavioral_trainer',
    'boarding_center',
    'role_boarding_center'
  ];
  
  if (!validRoles.includes(roleId)) {
    errors.push(`Invalid role ID. Must be one of: ${validRoles.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Service Type Validation
 */
export function validateServiceType(serviceType: string, roleId: string): ValidationResult {
  const errors: string[] = [];
  
  if (!serviceType) {
    errors.push('Service type is required');
    return { isValid: false, errors };
  }
  
  // Vet-specific types
  if (roleId.includes('vet') || roleId.includes('clinic')) {
    if (!['tele', 'clinic', 'home'].includes(serviceType)) {
      errors.push('Service type for vets must be: tele, clinic, or home');
    }
  } else {
    // Other services
    if (!['center', 'home'].includes(serviceType)) {
      errors.push('Service type must be: center or home');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Pet Type Validation
 */
export function validatePetType(petType: string): ValidationResult {
  const errors: string[] = [];
  
  if (!petType) {
    errors.push('Pet type is required');
    return { isValid: false, errors };
  }
  
  const validTypes = ['dog', 'cat', 'bird', 'rabbit', 'hamster', 'fish', 'other'];
  if (!validTypes.includes(petType.toLowerCase())) {
    errors.push(`Pet type must be one of: ${validTypes.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Booking Status Validation
 */
export function validateBookingStatus(status: string): ValidationResult {
  const errors: string[] = [];
  
  if (!status) {
    errors.push('Status is required');
    return { isValid: false, errors };
  }
  
  const validStatuses = ['confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled'];
  if (!validStatuses.includes(status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Payment Method Validation
 */
export function validatePaymentMethod(method: string): ValidationResult {
  const errors: string[] = [];
  
  if (!method) {
    errors.push('Payment method is required');
    return { isValid: false, errors };
  }
  
  const validMethods = ['card', 'upi', 'wallet', 'cod', 'netbanking'];
  if (!validMethods.includes(method.toLowerCase())) {
    errors.push(`Payment method must be one of: ${validMethods.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Location Validation
 */
export function validateLocation(location: any): ValidationResult {
  const errors: string[] = [];
  
  if (!location) {
    errors.push('Location is required for home services');
    return { isValid: false, errors };
  }
  
  if (!location.address || location.address.trim().length < 10) {
    errors.push('Address must be at least 10 characters');
  }
  
  if (location.lat !== undefined && (typeof location.lat !== 'number' || location.lat < -90 || location.lat > 90)) {
    errors.push('Invalid latitude');
  }
  
  if (location.lon !== undefined && (typeof location.lon !== 'number' || location.lon < -180 || location.lon > 180)) {
    errors.push('Invalid longitude');
  }
  
  if (location.pincode && !/^\d{6}$/.test(location.pincode)) {
    errors.push('Pincode must be exactly 6 digits');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Comprehensive Booking Validation
 */
export function validateBookingData(bookingData: Partial<BookingRecord>): ValidationResult {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  
  // Validate customer phone
  const phoneValidation = validatePhone(bookingData.customerPhone || '');
  if (!phoneValidation.isValid) {
    allErrors.push(...phoneValidation.errors);
  }
  
  // Validate pet ID
  if (!bookingData.petId) {
    allErrors.push('Pet ID is required');
  }
  
  // Validate vendor ID
  if (!bookingData.vendorId) {
    allErrors.push('Vendor ID is required');
  }
  
  // Validate service ID
  if (!bookingData.serviceId) {
    allErrors.push('Service ID is required');
  }
  
  // Validate role ID
  if (bookingData.roleId) {
    const roleValidation = validateRoleId(bookingData.roleId);
    if (!roleValidation.isValid) {
      allErrors.push(...roleValidation.errors);
    }
  } else {
    allErrors.push('Role ID is required');
  }
  
  // Validate service type
  if (bookingData.serviceType && bookingData.roleId) {
    const typeValidation = validateServiceType(bookingData.serviceType, bookingData.roleId);
    if (!typeValidation.isValid) {
      allErrors.push(...typeValidation.errors);
    }
  }
  
  // Validate scheduled date
  if (bookingData.scheduledDate) {
    const dateValidation = validateDate(bookingData.scheduledDate);
    if (!dateValidation.isValid) {
      allErrors.push(...dateValidation.errors);
    }
    if (dateValidation.warnings) {
      allWarnings.push(...dateValidation.warnings);
    }
  } else {
    allErrors.push('Scheduled date is required');
  }
  
  // Validate scheduled time
  if (bookingData.scheduledTime) {
    const timeValidation = validateTime(bookingData.scheduledTime);
    if (!timeValidation.isValid) {
      allErrors.push(...timeValidation.errors);
    }
  } else {
    allErrors.push('Scheduled time is required');
  }
  
  // Validate amount
  if (bookingData.amount !== undefined) {
    const amountValidation = validateAmount(bookingData.amount);
    if (!amountValidation.isValid) {
      allErrors.push(...amountValidation.errors);
    }
  } else {
    allErrors.push('Amount is required');
  }
  
  // Validate payment method
  if (bookingData.paymentMethod) {
    const paymentValidation = validatePaymentMethod(bookingData.paymentMethod);
    if (!paymentValidation.isValid) {
      allErrors.push(...paymentValidation.errors);
    }
  } else {
    allErrors.push('Payment method is required');
  }
  
  // Validate location for home services
  if (bookingData.serviceType === 'home' && bookingData.customerLocation) {
    const locationValidation = validateLocation(bookingData.customerLocation);
    if (!locationValidation.isValid) {
      allErrors.push(...locationValidation.errors);
    }
  }
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings.length > 0 ? allWarnings : undefined
  };
}

/**
 * Validate Cancellation Request
 */
export function validateCancellation(booking: BookingRecord, cancelDate: Date): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check booking status
  if (booking.status === 'cancelled') {
    errors.push('Booking is already cancelled');
  }
  
  if (booking.status === 'completed') {
    errors.push('Cannot cancel a completed booking');
  }
  
  // Check if booking date has passed
  const bookingDate = new Date(`${booking.scheduledDate} ${booking.scheduledTime}`);
  if (bookingDate < cancelDate) {
    errors.push('Cannot cancel a booking that has already started');
  }
  
  // Warning for late cancellation
  const hoursUntilStart = (bookingDate.getTime() - cancelDate.getTime()) / (1000 * 60 * 60);
  if (hoursUntilStart < 12) {
    warnings.push('Cancelling less than 12 hours before booking may result in reduced refund');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Validate Reschedule Request
 */
export function validateReschedule(
  booking: BookingRecord,
  newDate: string,
  newTime: string,
  currentDate: Date
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check booking status
  if (booking.status === 'cancelled') {
    errors.push('Cannot reschedule a cancelled booking');
  }
  
  if (booking.status === 'completed') {
    errors.push('Cannot reschedule a completed booking');
  }
  
  // Check reschedule limit
  const rescheduleCount = (booking as any).rescheduleCount || 0;
  if (rescheduleCount >= 2) {
    errors.push('Maximum reschedule limit (2) reached for this booking');
  }
  
  // Validate new date
  const dateValidation = validateDate(newDate);
  if (!dateValidation.isValid) {
    errors.push(...dateValidation.errors);
  }
  
  // Validate new time
  const timeValidation = validateTime(newTime);
  if (!timeValidation.isValid) {
    errors.push(...timeValidation.errors);
  }
  
  // Check if original booking date has passed
  const originalDate = new Date(`${booking.scheduledDate} ${booking.scheduledTime}`);
  if (originalDate < currentDate) {
    errors.push('Cannot reschedule a booking that has already started');
  }
  
  // Check reschedule window (at least 12 hours before original booking)
  const hoursUntilOriginal = (originalDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60);
  if (hoursUntilOriginal < 12) {
    errors.push('Cannot reschedule less than 12 hours before the original booking time');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Sanitize Input - Remove potentially harmful characters
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Remove script tags content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Validate and Sanitize Booking Data
 */
export function validateAndSanitizeBooking(bookingData: any): {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  sanitizedData?: Partial<BookingRecord>;
} {
  // First validate
  const validation = validateBookingData(bookingData);
  
  if (!validation.isValid) {
    return {
      isValid: false,
      errors: validation.errors,
      warnings: validation.warnings
    };
  }
  
  // Sanitize string fields
  const sanitizedData: any = { ...bookingData };
  
  if (sanitizedData.customerName) {
    sanitizedData.customerName = sanitizeInput(sanitizedData.customerName);
  }
  
  if (sanitizedData.petName) {
    sanitizedData.petName = sanitizeInput(sanitizedData.petName);
  }
  
  if (sanitizedData.vendorName) {
    sanitizedData.vendorName = sanitizeInput(sanitizedData.vendorName);
  }
  
  if (sanitizedData.notes) {
    sanitizedData.notes = sanitizeInput(sanitizedData.notes);
  }
  
  if (sanitizedData.customerLocation?.address) {
    sanitizedData.customerLocation.address = sanitizeInput(sanitizedData.customerLocation.address);
  }
  
  if (sanitizedData.customerLocation?.instructions) {
    sanitizedData.customerLocation.instructions = sanitizeInput(sanitizedData.customerLocation.instructions);
  }
  
  return {
    isValid: true,
    errors: [],
    warnings: validation.warnings,
    sanitizedData
  };
}
