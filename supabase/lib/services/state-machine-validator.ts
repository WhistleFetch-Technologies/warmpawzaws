/**
 * ============================================================================
 * STATE MACHINE VALIDATOR
 * ============================================================================
 * 
 * Validates booking state transitions
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { selectQuery } from "../db.ts";

export interface TransitionValidation {
  allowed: boolean;
  requires_otp: boolean;
  requires_payment: boolean;
  requires_refund_check: boolean;
  reason?: string;
}

/**
 * Validate booking state transition
 */
export async function validateBookingTransition(
  fromStatus: string,
  toStatus: string,
  options?: {
    hasOtp?: boolean;
    hasPayment?: boolean;
    hasRefund?: boolean;
  }
): Promise<TransitionValidation> {
  // Check exact match first
  let results = await selectQuery(
    `SELECT allowed, requires_otp, requires_payment, requires_refund_check, description
     FROM booking_state_transitions
     WHERE from_status = $1 AND to_status = $2`,
    [fromStatus, toStatus]
  );
  
  // If not found, check wildcard
  if (!results || results.length === 0) {
    results = await selectQuery(
      `SELECT allowed, requires_otp, requires_payment, requires_refund_check, description
       FROM booking_state_transitions
       WHERE from_status = '*' AND to_status = $1`,
      [toStatus]
    );
  }
  
  // If still not found, invalid transition
  if (!results || results.length === 0) {
    return {
      allowed: false,
      requires_otp: false,
      requires_payment: false,
      requires_refund_check: false,
      reason: `Invalid transition: ${fromStatus} → ${toStatus}`
    };
  }
  
  const transition = results[0];
  
  // Check if transition is allowed
  if (!transition.allowed) {
    return {
      allowed: false,
      requires_otp: transition.requires_otp || false,
      requires_payment: transition.requires_payment || false,
      requires_refund_check: transition.requires_refund_check || false,
      reason: `Transition ${fromStatus} → ${toStatus} is not allowed`
    };
  }
  
  // Check requirements
  if (transition.requires_otp && (!options?.hasOtp)) {
    return {
      allowed: false,
      requires_otp: true,
      requires_payment: transition.requires_payment || false,
      requires_refund_check: transition.requires_refund_check || false,
      reason: `Transition ${fromStatus} → ${toStatus} requires OTP verification`
    };
  }
  
  if (transition.requires_payment && (!options?.hasPayment)) {
    return {
      allowed: false,
      requires_otp: transition.requires_otp || false,
      requires_payment: true,
      requires_refund_check: transition.requires_refund_check || false,
      reason: `Transition ${fromStatus} → ${toStatus} requires payment`
    };
  }
  
  if (transition.requires_refund_check && (!options?.hasRefund)) {
    return {
      allowed: false,
      requires_otp: transition.requires_otp || false,
      requires_payment: transition.requires_payment || false,
      requires_refund_check: true,
      reason: `Transition ${fromStatus} → ${toStatus} requires refund check`
    };
  }
  
  return {
    allowed: true,
    requires_otp: transition.requires_otp || false,
    requires_payment: transition.requires_payment || false,
    requires_refund_check: transition.requires_refund_check || false
  };
}

/**
 * Validate payment state transition
 */
export async function validatePaymentTransition(
  fromStatus: string,
  toStatus: string
): Promise<boolean> {
  // Valid payment transitions
  const validTransitions: Record<string, string[]> = {
    'pending': ['processing', 'failed', 'cancelled'],
    'processing': ['paid', 'failed'],
    'paid': ['refunded', 'partially_refunded'],
    'failed': ['pending', 'cancelled'],
    'refunded': [],
    'partially_refunded': ['refunded'],
    'cancelled': []
  };
  
  const allowed = validTransitions[fromStatus] || [];
  return allowed.includes(toStatus);
}

/**
 * Validate settlement state transition
 */
export async function validateSettlementTransition(
  fromStatus: string,
  toStatus: string
): Promise<boolean> {
  // Valid settlement transitions
  const validTransitions: Record<string, string[]> = {
    'pending': ['processing', 'failed'],
    'processing': ['completed', 'failed'],
    'completed': [],
    'failed': ['pending']
  };
  
  const allowed = validTransitions[fromStatus] || [];
  return allowed.includes(toStatus);
}

