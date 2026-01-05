/**
 * State Machine Validator - Inline implementation for Lambda
 * Validates booking and payment state transitions using SQL
 */
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
export declare function validateBookingTransition(fromStatus: string, toStatus: string, options?: {
    hasOtp?: boolean;
    hasPayment?: boolean;
    hasRefund?: boolean;
}): Promise<TransitionValidation>;
/**
 * Validate payment state transition
 */
export declare function validatePaymentTransition(fromStatus: string, toStatus: string): Promise<boolean>;
/**
 * Alias for validateTransition (used by payment endpoints)
 */
export declare const validateTransition: typeof validatePaymentTransition;
//# sourceMappingURL=state-machine-validator.d.ts.map