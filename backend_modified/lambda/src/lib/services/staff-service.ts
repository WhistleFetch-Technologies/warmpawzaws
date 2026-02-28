/**
 * ============================================================================
 * STAFF SERVICE - BUSINESS LOGIC LAYER
 * ============================================================================
 * 
 * Functional model for staff management capabilities
 * Contains pure business logic for staff operations
 * 
 * Capabilities: staff_create, staff_schedule
 * ============================================================================
 */

import { isValidUUID } from '../../types/entities';

export interface StaffMemberData {
  vendorId: string;
  name: string;
  phone: string;
  email?: string;
  role?: string;
  specialization?: string[];
  isActive?: boolean;
  mobileVerified?: boolean;
}

export interface StaffScheduleData {
  staffId: string;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  isAvailable: boolean;
}

export interface StaffValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates staff member data according to business rules
 */
export function validateStaffMember(data: StaffMemberData): StaffValidationResult {
  const errors: string[] = [];

  // Vendor ID validation
  if (!data.vendorId || !isValidUUID(data.vendorId)) {
    errors.push('Valid vendorId is required');
  }

  // Name validation
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Staff name is required');
  }

  if (data.name && data.name.length > 200) {
    errors.push('Staff name exceeds 200 characters');
  }

  // Phone validation
  if (!data.phone || data.phone.trim().length === 0) {
    errors.push('Phone number is required');
  } else {
    // Indian phone number validation
    const phoneRegex = /^[6-9]\d{9}$/;
    const cleanedPhone = data.phone.replace(/[\s-]/g, '');
    if (!phoneRegex.test(cleanedPhone)) {
      errors.push('Phone number must be a valid 10-digit Indian mobile number');
    }
  }

  // Email validation (optional but must be valid if provided)
  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Email must be a valid email address');
    }
    if (data.email.length > 255) {
      errors.push('Email exceeds 255 characters');
    }
  }

  // Role validation
  if (data.role && data.role.length > 100) {
    errors.push('Role exceeds 100 characters');
  }

  // Specialization validation
  if (data.specialization && !Array.isArray(data.specialization)) {
    errors.push('Specialization must be an array');
  } else if (data.specialization && data.specialization.length > 10) {
    errors.push('Maximum 10 specializations allowed');
  } else if (data.specialization) {
    data.specialization.forEach((spec, index) => {
      if (!spec || spec.trim().length === 0) {
        errors.push(`Specialization ${index + 1} cannot be empty`);
      }
      if (spec && spec.length > 100) {
        errors.push(`Specialization ${index + 1} exceeds 100 characters`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates staff schedule data according to business rules
 */
export function validateStaffSchedule(data: StaffScheduleData): StaffValidationResult {
  const errors: string[] = [];

  // Staff ID validation
  if (!data.staffId || !isValidUUID(data.staffId)) {
    errors.push('Valid staffId is required');
  }

  // Day of week validation
  if (data.dayOfWeek === undefined || data.dayOfWeek === null) {
    errors.push('Day of week is required');
  } else if (data.dayOfWeek < 0 || data.dayOfWeek > 6) {
    errors.push('Day of week must be between 0 (Sunday) and 6 (Saturday)');
  }

  // Time validation
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

  if (!data.startTime || !timeRegex.test(data.startTime)) {
    errors.push('Start time must be in HH:mm format (24-hour)');
  }

  if (!data.endTime || !timeRegex.test(data.endTime)) {
    errors.push('End time must be in HH:mm format (24-hour)');
  }

  // Time logic validation
  if (data.startTime && data.endTime && timeRegex.test(data.startTime) && timeRegex.test(data.endTime)) {
    const [startHours, startMinutes] = data.startTime.split(':').map(Number);
    const [endHours, endMinutes] = data.endTime.split(':').map(Number);
    const startTotal = startHours * 60 + startMinutes;
    const endTotal = endHours * 60 + endMinutes;

    if (startTotal >= endTotal) {
      errors.push('End time must be after start time');
    }

    // Business rule: Minimum shift duration is 2 hours
    const duration = endTotal - startTotal;
    if (duration < 120) {
      errors.push('Shift duration must be at least 2 hours');
    }

    // Business rule: Maximum shift duration is 12 hours
    if (duration > 720) {
      errors.push('Shift duration cannot exceed 12 hours');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Normalizes staff member data for database storage
 */
export function normalizeStaffMemberData(data: StaffMemberData): any {
  const normalized: any = {
    vendor_id: data.vendorId,
    name: data.name.trim(),
    phone: data.phone.replace(/[\s-]/g, ''), // Remove spaces and dashes
    is_active: data.isActive !== undefined ? data.isActive : true,
    mobile_verified: data.mobileVerified !== undefined ? data.mobileVerified : false,
  };

  if (data.email) {
    normalized.email = data.email.trim().toLowerCase();
  }

  if (data.role) {
    normalized.role = data.role.trim();
  }

  if (data.specialization && data.specialization.length > 0) {
    normalized.specialization = JSON.stringify(data.specialization.map(s => s.trim()));
  }

  return normalized;
}

/**
 * Normalizes staff schedule data for database storage
 */
export function normalizeStaffScheduleData(data: StaffScheduleData): any {
  return {
    staff_id: data.staffId,
    day_of_week: data.dayOfWeek,
    start_time: data.startTime,
    end_time: data.endTime,
    is_available: data.isAvailable !== undefined ? data.isAvailable : true,
  };
}

/**
 * Formats staff member for API response
 */
export function formatStaffMemberResponse(staff: any): any {
  return {
    id: staff.id,
    vendorId: staff.vendor_id,
    name: staff.name,
    phone: staff.phone,
    email: staff.email,
    role: staff.role,
    specialization: staff.specialization ? JSON.parse(staff.specialization) : [],
    isActive: staff.is_active,
    mobileVerified: staff.mobile_verified,
    createdAt: staff.created_at,
    updatedAt: staff.updated_at,
  };
}

/**
 * Formats staff schedule for API response
 */
export function formatStaffScheduleResponse(schedule: any): any {
  return {
    id: schedule.id,
    staffId: schedule.staff_id,
    dayOfWeek: schedule.day_of_week,
    startTime: schedule.start_time,
    endTime: schedule.end_time,
    isAvailable: schedule.is_available,
    createdAt: schedule.created_at,
    updatedAt: schedule.updated_at,
  };
}

/**
 * Checks if staff member can be deleted (business rule)
 */
export function canDeleteStaffMember(staff: any, hasActiveBookings: boolean): boolean {
  // Business rule: Staff with active bookings cannot be deleted
  return !hasActiveBookings;
}

/**
 * Validates schedule overlap (business rule: no overlapping schedules)
 */
export function validateScheduleOverlap(
  schedules: StaffScheduleData[],
  newSchedule: StaffScheduleData
): StaffValidationResult {
  const errors: string[] = [];

  const sameDaySchedules = schedules.filter(s => s.dayOfWeek === newSchedule.dayOfWeek);

  for (const schedule of sameDaySchedules) {
    const [newStartHours, newStartMinutes] = newSchedule.startTime.split(':').map(Number);
    const [newEndHours, newEndMinutes] = newSchedule.endTime.split(':').map(Number);
    const [existingStartHours, existingStartMinutes] = schedule.startTime.split(':').map(Number);
    const [existingEndHours, existingEndMinutes] = schedule.endTime.split(':').map(Number);

    const newStart = newStartHours * 60 + newStartMinutes;
    const newEnd = newEndHours * 60 + newEndMinutes;
    const existingStart = existingStartHours * 60 + existingStartMinutes;
    const existingEnd = existingEndHours * 60 + existingEndMinutes;

    // Check for overlap
    if (
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    ) {
      errors.push(
        `Schedule overlaps with existing schedule: ${schedule.startTime} - ${schedule.endTime}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
