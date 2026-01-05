/**
 * ============================================================================
 * REFUNDS REPOSITORY
 * ============================================================================
 *
 * Repository for refund data access.
 * Replaces: refund:{refundId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
import type { Pool } from "../db";
export interface Refund {
    id: string;
    payment_id: string;
    booking_id?: string | null;
    customer_id: string;
    vendor_id?: string | null;
    refund_amount: number;
    refund_reason: string;
    refund_status: string;
    razorpay_refund_id?: string | null;
    requested_at: string;
    processed_at?: string | null;
    completed_at?: string | null;
    rejection_reason?: string | null;
}
export interface CreateRefundInput {
    payment_id: string;
    booking_id?: string;
    customer_id: string;
    vendor_id?: string;
    refund_amount: number;
    refund_reason: string;
    refund_status?: string;
    razorpay_refund_id?: string;
}
export declare class RefundsRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    findById(refundId: string): Promise<Refund | null>;
    findByPayment(paymentId: string): Promise<Refund[]>;
    findByCustomer(customerId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Refund[]>;
    create(input: CreateRefundInput): Promise<Refund>;
    update(refundId: string, input: Partial<CreateRefundInput & {
        refund_status?: string;
        processed_at?: string;
        completed_at?: string;
        rejection_reason?: string;
    }>): Promise<Refund>;
    approve(refundId: string): Promise<Refund>;
    complete(refundId: string, razorpayRefundId?: string): Promise<Refund>;
    reject(refundId: string, reason: string): Promise<Refund>;
}
export declare function getRefundsRepository(): RefundsRepository;
//# sourceMappingURL=refunds.d.ts.map