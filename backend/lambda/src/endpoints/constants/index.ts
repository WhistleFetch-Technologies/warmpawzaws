export const isTeleServices = ['tele', 'video_consultation', 'teleconsultation', 'video']

export const enum UserType {
    CUSTOMER = 'customer',
    VENDOR = 'vendor',
    STAFF = 'staff',
}

export const enum BookingStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    NO_SHOW = 'no_show',
    RESCHEDULED = 'rescheduled',
    PENDING_PAYMENT = 'pending_payment',
    REJECTED = 'rejected',
    EXPIRED = 'expired',
}


export const enum BookingPaymentStatus {
    PENDING = 'pending',
    PARTIAL = 'partial',
    PAID = 'paid',
    REFUNDED = 'refunded',
    FAILED = 'failed',
    REFUND_FAILED = 'refund_failed',
}

export const enum PaymentTransactionStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    REFUNDED = 'refunded',
    PARTIALLY_REFUNDED = 'partially_refunded',
    REFUND_FAILED = 'refund_failed',
}


export const enum InstantTeleEventType {
    VENDOR_ACCEPTED = 'vendor_accepted',
    VENDOR_REJECTED = 'vendor_rejected',
    PAYMENT_CONFIRMED = 'payment_confirmed',
    PAYMENT_COMPLETED = 'payment_completed',
    STATUS_UPDATE = 'status_update',
    ENDED = 'ended',
    ERROR = 'error',
    REJECTED_BUT_PAID = 'rejected_but_paid',
    CANCELLED_BUT_PAID = 'cancelled_but_paid',
}
