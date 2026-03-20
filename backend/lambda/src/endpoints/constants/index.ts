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
    VENDOR_ON_WAY = 'vendor_on_way',
    IN_TRANSIT = 'in_transit',
    CHECKED_IN = 'checked_in',  // For grooming, boarding services
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


export const enum ServiceStyle {
    AT_HOME = 'at_home',
    AT_CENTER = 'at_center',
    TELE = 'tele',
}


export const enum gps_tracking_sessions {
    PENDING = 'pending',
    STARTED = 'started',
    IN_TRANSIT = 'in_transit',
    ARRIVED = 'arrived',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    VIDEO_CONSULTATION = 'video_consultation',
    ACTIVE = 'active',
    IS_TRAVELING = 'is_traveling',
}

export const enum OtpAction {
    START = 'start',
    COMPLETE = 'complete',
    END = 'end',  // Normalized to 'complete' in code
}