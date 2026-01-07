/**
 * ============================================================================
 * SETTLEMENTS REPOSITORY
 * ============================================================================
 *
 * Repository for settlement data access.
 * Replaces: settlement:{settlementId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
import type { Pool } from "../db";
export interface Settlement {
    id: string;
    vendor_id: string;
    booking_id?: string | null;
    payment_id?: string | null;
    settlement_amount: number;
    commission_amount: number;
    vendor_amount: number;
    currency: string;
    settlement_status: string;
    razorpay_settlement_id?: string | null;
    settlement_date: string;
    created_at: string;
    processed_at?: string | null;
    completed_at?: string | null;
}
export interface CreateSettlementInput {
    vendor_id: string;
    booking_id?: string;
    payment_id?: string;
    settlement_amount: number;
    commission_amount: number;
    vendor_amount: number;
    razorpay_settlement_id?: string;
    settlement_date?: string;
}
export declare class SettlementsRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    findById(settlementId: string): Promise<Settlement | null>;
    findByVendor(vendorId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Settlement[]>;
    findByBooking(bookingId: string): Promise<Settlement | null>;
    create(input: CreateSettlementInput): Promise<Settlement>;
    update(settlementId: string, input: Partial<CreateSettlementInput & {
        settlement_status?: string;
        processed_at?: string;
        completed_at?: string;
    }>): Promise<Settlement>;
    complete(settlementId: string): Promise<Settlement>;
}
export declare function getSettlementsRepository(): SettlementsRepository;
//# sourceMappingURL=settlements.d.ts.map