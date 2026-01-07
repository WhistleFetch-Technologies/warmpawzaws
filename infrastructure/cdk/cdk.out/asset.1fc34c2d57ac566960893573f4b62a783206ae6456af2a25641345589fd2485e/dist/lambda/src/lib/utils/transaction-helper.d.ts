/**
 * Transaction Helper - Inline implementation for Lambda
 * Creates bookings with payments atomically using SQL transactions
 */
export interface CreateBookingWithPaymentInput {
    customer_id: string;
    vendor_id: string;
    staff_id?: string | null;
    service_id: string;
    booking_date: string;
    booking_time: string;
    service_type: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    base_price: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    status: string;
    payment_status: string;
    notes?: string | null;
}
export interface CreatePaymentInput {
    customer_id: string;
    amount: number;
    payment_method: string;
    payment_gateway: string;
    gateway_transaction_id?: string | null;
}
export interface BookingWithPaymentResult {
    booking: any;
    payment: any;
}
/**
 * Create booking with payment atomically
 */
export declare function createBookingWithPayment(bookingData: CreateBookingWithPaymentInput, paymentData: CreatePaymentInput): Promise<BookingWithPaymentResult>;
//# sourceMappingURL=transaction-helper.d.ts.map