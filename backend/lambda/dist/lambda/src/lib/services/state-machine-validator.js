"use strict";
/**
 * State Machine Validator - Inline implementation for Lambda
 * Validates booking and payment state transitions using SQL
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTransition = void 0;
exports.validateBookingTransition = validateBookingTransition;
exports.validatePaymentTransition = validatePaymentTransition;
const db_1 = require("../db");
/**
 * Validate booking state transition
 */
async function validateBookingTransition(fromStatus, toStatus, options) {
    // Check exact match first
    let results = await (0, db_1.selectQuery)(`SELECT allowed, requires_otp, requires_payment, requires_refund_check, description
     FROM booking_state_transitions
     WHERE from_status = $1 AND to_status = $2`, [fromStatus, toStatus]);
    // If not found, check wildcard
    if (!results || results.length === 0) {
        results = await (0, db_1.selectQuery)(`SELECT allowed, requires_otp, requires_payment, requires_refund_check, description
       FROM booking_state_transitions
       WHERE from_status = '*' AND to_status = $1`, [toStatus]);
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
async function validatePaymentTransition(fromStatus, toStatus) {
    const results = await (0, db_1.selectQuery)(`SELECT allowed FROM payment_state_transitions
     WHERE from_status = $1 AND to_status = $2`, [fromStatus, toStatus]);
    return results && results.length > 0 && results[0].allowed === true;
}
/**
 * Alias for validateTransition (used by payment endpoints)
 */
exports.validateTransition = validatePaymentTransition;
//# sourceMappingURL=state-machine-validator.js.map