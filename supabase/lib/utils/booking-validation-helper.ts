/**
 * ============================================================================
 * BOOKING VALIDATION HELPER
 * ============================================================================
 * 
 * Helper functions for validating bookings using Business Rules Engine
 * 
 * Date: 2025-01-27
 * Phase 2: Task 2.7
 * ============================================================================
 */

import { getInitializedBusinessRulesEngine } from '../services/business-rules/index.ts';
import type { ValidationContext } from '../services/business-rules-engine.ts';

/**
 * Validate booking context using Business Rules Engine
 */
export async function validateBookingContext(context: {
  vendor_id?: string;
  staff_id?: string | null;
  customer_id?: string;
  service_type?: string;
  booking_date?: string;
  booking_time?: string;
  duration_minutes?: number;
  latitude?: number;
  longitude?: number;
}): Promise<{
  valid: boolean;
  violations?: Array<{
    rule: string;
    message: string;
    error_code?: string;
  }>;
  error?: string;
}> {
  try {
    const engine = getInitializedBusinessRulesEngine();

    const validationContext: ValidationContext = {
      booking: {
        vendor_id: context.vendor_id,
        staff_id: context.staff_id || null,
        customer_id: context.customer_id,
        service_type: context.service_type,
        booking_date: context.booking_date,
        booking_time: context.booking_time,
        duration_minutes: context.duration_minutes,
        latitude: context.latitude,
        longitude: context.longitude,
      },
    };

    // Validate using business rules engine
    const result = await engine.validate(validationContext);

    if (!result.valid) {
      return {
        valid: false,
        violations: result.violations,
        error: result.violations.map((v) => v.message).join('; '),
      };
    }

    return {
      valid: true,
    };
  } catch (error) {
    console.error('[BOOKING_VALIDATION] Error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to validate booking',
    };
  }
}

/**
 * Format validation error for API response
 */
export function formatValidationError(
  violations: Array<{ rule: string; message: string; error_code?: string }>
): { message: string; error_code: string; violations: typeof violations } {
  const messages = violations.map((v) => v.message);
  const primaryErrorCode = violations[0]?.error_code || 'VALIDATION_FAILED';

  return {
    message: messages.join('; '),
    error_code: primaryErrorCode,
    violations,
  };
}

