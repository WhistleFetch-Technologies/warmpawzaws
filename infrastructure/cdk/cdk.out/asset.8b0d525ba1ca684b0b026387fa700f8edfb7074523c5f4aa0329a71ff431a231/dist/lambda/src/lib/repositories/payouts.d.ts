/**
 * ============================================================================
 * PAYOUTS REPOSITORY
 * ============================================================================
 *
 * Repository for payout data access.
 * Replaces: payout:{payoutId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
import type { Pool } from "../db";
export interface Payout {
    id: string;
    vendor_id: string;
    amount: number;
    currency: string;
    payout_status: string;
    bank_account_number: string;
    ifsc_code: string;
    account_holder_name: string;
    razorpay_payout_id?: string | null;
    settlement_id?: string | null;
    payment_ids: string[];
    created_at: string;
    processed_at?: string | null;
    completed_at?: string | null;
    failure_reason?: string | null;
}
export interface CreatePayoutInput {
    vendor_id: string;
    amount: number;
    bank_account_number: string;
    ifsc_code: string;
    account_holder_name: string;
    payment_ids: string[];
    razorpay_payout_id?: string;
    settlement_id?: string;
}
export declare class PayoutsRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    findById(payoutId: string): Promise<Payout | null>;
    findByVendor(vendorId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Payout[]>;
    findByStatus(status: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Payout[]>;
    create(input: CreatePayoutInput): Promise<Payout>;
    update(payoutId: string, input: Partial<CreatePayoutInput & {
        payout_status?: string;
        processed_at?: string;
        completed_at?: string;
        failure_reason?: string;
    }>): Promise<Payout>;
    complete(payoutId: string): Promise<Payout>;
    fail(payoutId: string, reason: string): Promise<Payout>;
}
export declare function getPayoutsRepository(): PayoutsRepository;
//# sourceMappingURL=payouts.d.ts.map