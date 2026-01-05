/**
 * ============================================================================
 * PAYMENTS REPOSITORY
 * ============================================================================
 *
 * Repository for payment data access.
 * Replaces: payment:{paymentId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 *
 * Date: 2024-12-22
 * ============================================================================
 */
import type { Pool } from "../db";
export interface Payment {
    id: string;
    booking_id?: string | null;
    order_id?: string | null;
    customer_id: string;
    vendor_id?: string | null;
    amount: number;
    currency: string;
    payment_method: string;
    payment_status: string;
    razorpay_order_id?: string | null;
    razorpay_payment_id?: string | null;
    razorpay_signature?: string | null;
    discount_amount: number;
    coupon_code?: string | null;
    promotion_id?: string | null;
    loyalty_points_used: number;
    wallet_amount_used: number;
    transaction_id?: string | null;
    failure_reason?: string | null;
    created_at: string;
    updated_at: string;
    completed_at?: string | null;
}
export interface CreatePaymentInput {
    booking_id?: string;
    order_id?: string;
    customer_id: string;
    vendor_id?: string;
    amount: number;
    currency?: string;
    payment_method: string;
    payment_status?: string;
    discount_amount?: number;
    coupon_code?: string;
    promotion_id?: string;
    loyalty_points_used?: number;
    wallet_amount_used?: number;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
}
export interface UpdatePaymentInput {
    payment_status?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    transaction_id?: string;
    failure_reason?: string;
    completed_at?: string;
}
export declare class PaymentsRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    /**
     * Get payment by ID
     * Replaces: kv.get(`payment:${paymentId}`)
     */
    findById(paymentId: string): Promise<Payment | null>;
    /**
     * Get payment by Razorpay order ID
     */
    findByRazorpayOrderId(orderId: string): Promise<Payment | null>;
    /**
     * Get payment by Razorpay payment ID
     */
    findByRazorpayPaymentId(paymentId: string): Promise<Payment | null>;
    /**
     * Get payments by customer
     * Replaces: customer:{id}:payments KV pattern
     */
    findByCustomer(customerId: string, options?: {
        limit?: number;
        offset?: number;
        status?: string;
    }): Promise<Payment[]>;
    /**
     * Get payments by vendor
     * Replaces: vendor:{id}:payments KV pattern
     */
    findByVendor(vendorId: string, options?: {
        limit?: number;
        offset?: number;
        status?: string;
    }): Promise<Payment[]>;
    /**
     * Get payments by booking
     */
    findByBooking(bookingId: string): Promise<Payment[]>;
    /**
     * Get payments by order
     */
    findByOrder(orderId: string): Promise<Payment[]>;
    /**
     * Create a new payment
     * Replaces: kv.set(`payment:${paymentId}`, paymentData)
     */
    create(input: CreatePaymentInput): Promise<Payment>;
    /**
     * Update payment
     * Replaces: kv.set(`payment:${paymentId}`, updatedData)
     */
    update(paymentId: string, input: UpdatePaymentInput): Promise<Payment>;
    /**
     * Mark payment as completed
     */
    complete(paymentId: string, transactionId?: string): Promise<Payment>;
    /**
     * Mark payment as failed
     */
    fail(paymentId: string, reason: string): Promise<Payment>;
    /**
     * Mark payment as refunded
     */
    refund(paymentId: string): Promise<Payment>;
    /**
     * Create payment history entry
     * Replaces: customer:{id}:payments, vendor:{id}:payments KV patterns
     */
    private createPaymentHistory;
}
export declare function getPaymentsRepository(): PaymentsRepository;
//# sourceMappingURL=payments.d.ts.map