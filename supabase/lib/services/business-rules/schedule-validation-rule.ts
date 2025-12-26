/**
 * ============================================================================
 * SCHEDULE VALIDATION RULE
 * ============================================================================
 * 
 * Business rules for schedule availability, buffer time, and lead time validation
 * Integrates with Business Rules Engine
 * 
 * Date: 2025-01-27
 * Phase 2: Task 2.3, 2.5, 2.6
 * ============================================================================
 */

import { createRule, type ValidationContext, type ValidationResult } from '../business-rules-engine.ts';
import { SchedulingService } from '../scheduling-service.ts';

const schedulingService = new SchedulingService();
import { SchedulingService } from '../scheduling-service.ts';

const schedulingService = new SchedulingService();

/**
 * Schedule availability validation rule
 * Validates that staff/vendor is available at the requested time
 */
export function createScheduleAvailabilityRule() {
  return createRule(
    'schedule_availability',
    async (context: ValidationContext): Promise<ValidationResult> => {
      // Only validate if booking context is provided
      if (!context.booking) {
        return { valid: true }; // Skip if no booking context
      }

      const { vendor_id, staff_id, booking_date, booking_time, service_type, duration_minutes } = context.booking;

      if (!vendor_id || !booking_date || !booking_time || !service_type) {
        return {
          valid: false,
          message: 'Vendor ID, booking date, booking time, and service type are required',
          error_code: 'MISSING_BOOKING_DATA',
        };
      }

      try {
        // Use SchedulingService to validate availability via createBookingWithValidation
        // This method performs comprehensive validation including availability checks
        const duration = duration_minutes || 30;

        // Check slot capacity via repository
        const schedulingRepo = await import('../../repositories/scheduling.ts').then(m => m.getSchedulingRepository());
        const capacity = await schedulingRepo.getSlotCapacity(
          vendor_id,
          staff_id || null,
          booking_date,
          booking_time,
          service_type
        );

        if (capacity && capacity.current_bookings >= capacity.max_capacity) {
          return {
            valid: false,
            message: 'Time slot is fully booked',
            error_code: 'SLOT_NOT_AVAILABLE',
            metadata: {
              vendor_id,
              staff_id,
              booking_date,
              booking_time,
              service_type,
              duration_minutes: duration,
              current_bookings: capacity.current_bookings,
              max_capacity: capacity.max_capacity,
            },
          };
        }

        // Check if slot is reserved
        const isReserved = await schedulingRepo.isSlotReserved(
          vendor_id,
          staff_id || null,
          booking_date,
          booking_time
        );

        if (isReserved) {
          return {
            valid: false,
            message: 'Time slot is reserved',
            error_code: 'SLOT_RESERVED',
            metadata: {
              vendor_id,
              staff_id,
              booking_date,
              booking_time,
              service_type,
            },
          };
        }

        return {
          valid: true,
          metadata: {
            vendor_id,
            staff_id,
            booking_date,
            booking_time,
            service_type,
            duration_minutes: duration,
          },
        };
      } catch (error) {
        console.error('[SCHEDULE_VALIDATION] Error:', error);
        return {
          valid: false,
          message: error instanceof Error ? error.message : 'Failed to validate schedule availability',
          error_code: 'SCHEDULE_VALIDATION_ERROR',
          metadata: { error: String(error) },
        };
      }
    },
    {
      priority: 90, // High priority, but after distance validation
      description: 'Validates that staff/vendor is available at the requested booking time',
      enabled: true,
      dependencies: ['distance_validation'], // Should validate distance first
    }
  );
}

/**
 * Buffer time validation rule
 * Validates that sufficient buffer time exists between bookings
 */
export function createBufferTimeRule() {
  return createRule(
    'buffer_time_validation',
    async (context: ValidationContext): Promise<ValidationResult> => {
      // Only validate if booking context is provided
      if (!context.booking) {
        return { valid: true }; // Skip if no booking context
      }

      const { vendor_id, staff_id, booking_date, booking_time, service_type, duration_minutes } = context.booking;

      if (!vendor_id || !booking_date || !booking_time || !service_type) {
        return { valid: true }; // Skip if required data not available
      }

      try {
        const duration = duration_minutes || 30;

        // Use SchedulingService to validate buffer time
        const bufferValidation = await schedulingService.validateBufferTime(
          vendor_id,
          staff_id || null,
          booking_date,
          booking_time,
          service_type,
          duration
        );

        if (!bufferValidation.valid) {
          return {
            valid: false,
            message: bufferValidation.error || 'Insufficient buffer time between bookings',
            error_code: 'INSUFFICIENT_BUFFER_TIME',
            metadata: {
              vendor_id,
              staff_id,
              booking_date,
              booking_time,
              service_type,
              duration_minutes: duration,
            },
          };
        }

        return {
          valid: true,
          metadata: {
            vendor_id,
            booking_date,
            booking_time,
            service_type,
          },
        };
      } catch (error) {
        console.error('[BUFFER_TIME_VALIDATION] Error:', error);
        return {
          valid: false,
          message: error instanceof Error ? error.message : 'Failed to validate buffer time',
          error_code: 'BUFFER_TIME_VALIDATION_ERROR',
          metadata: { error: String(error) },
        };
      }
    },
    {
      priority: 85, // After schedule availability
      description: 'Validates that sufficient buffer time exists between bookings',
      enabled: true,
      dependencies: ['schedule_availability'], // Should validate availability first
    }
  );
}

/**
 * Lead time validation rule
 * Validates that booking is made with sufficient lead time
 */
export function createLeadTimeRule() {
  return createRule(
    'lead_time_validation',
    async (context: ValidationContext): Promise<ValidationResult> => {
      // Only validate if booking context is provided
      if (!context.booking) {
        return { valid: true }; // Skip if no booking context
      }

      const { booking_date, booking_time, service_type, staff_id, vendor_id, latitude, longitude } = context.booking;

      if (!booking_date || !booking_time || !service_type) {
        return { valid: true }; // Skip if required data not available
      }

      // Only validate lead time for home services
      if (service_type !== 'at_home') {
        return { valid: true };
      }

      try {
        // Calculate booking datetime
        const bookingDateTime = new Date(`${booking_date}T${booking_time}`);
        const now = new Date();
        const timeUntilBooking = (bookingDateTime.getTime() - now.getTime()) / 60000; // minutes

        // Get lead time requirement from scheduling policy
        const schedulingRepo = await import('../../repositories/scheduling.ts').then(m => m.getSchedulingRepository());
        const policy = await schedulingRepo.getPolicy('lead_time');
        const requiredLeadTime = policy?.minLeadTimeMinutes?.[service_type] || 
                                 policy?.minLeadTimeMinutes?.at_home || 
                                 120; // Default 120 minutes (2 hours)

        // For home services with customer location, also need to account for commute time
        if (latitude && longitude && staff_id) {
          // Use SchedulingService to validate commute time (includes lead time)
          const commuteValidation = await schedulingService.validateCommuteTime(
            staff_id,
            vendor_id!,
            booking_date,
            booking_time,
            latitude,
            longitude
          );

          if (!commuteValidation.valid) {
            return {
              valid: false,
              message: commuteValidation.error || 'Insufficient lead time for booking',
              error_code: 'INSUFFICIENT_LEAD_TIME',
              metadata: {
                required_minutes: requiredLeadTime,
                available_minutes: Math.floor(timeUntilBooking),
                commute_time: commuteValidation.commuteTime,
              },
            };
          }

          return {
            valid: true,
            metadata: {
              required_minutes: requiredLeadTime,
              commute_time: commuteValidation.commuteTime,
            },
          };
        }

        // Simple lead time check for center/tele services or without location
        if (timeUntilBooking < requiredLeadTime) {
          return {
            valid: false,
            message: `Booking must be made at least ${requiredLeadTime} minutes in advance. Available time: ${Math.floor(timeUntilBooking)} minutes`,
            error_code: 'INSUFFICIENT_LEAD_TIME',
            metadata: {
              required_minutes: requiredLeadTime,
              available_minutes: Math.floor(timeUntilBooking),
            },
          };
        }

        return {
          valid: true,
          metadata: {
            required_minutes: requiredLeadTime,
            available_minutes: Math.floor(timeUntilBooking),
          },
        };
      } catch (error) {
        console.error('[LEAD_TIME_VALIDATION] Error:', error);
        return {
          valid: false,
          message: error instanceof Error ? error.message : 'Failed to validate lead time',
          error_code: 'LEAD_TIME_VALIDATION_ERROR',
          metadata: { error: String(error) },
        };
      }
    },
    {
      priority: 88, // After schedule availability, before buffer time
      description: 'Validates that booking is made with sufficient lead time',
      enabled: true,
      dependencies: ['schedule_availability'], // Should validate availability first
    }
  );
}

