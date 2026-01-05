/**
 * ============================================================================
 * COMMISSIONS REPOSITORY
 * ============================================================================
 *
 * Repository for commission/earnings data access.
 * Replaces: earnings:{earningsId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
import type { Pool } from "../db";
export interface Commission {
    id: string;
    booking_id?: string | null;
    payment_id?: string | null;
    vendor_id: string;
    customer_id: string;
    total_amount: number;
    commission_percentage: number;
    commission_amount: number;
    vendor_amount: number;
    status: string;
    realized_at?: string | null;
    created_at: string;
}
export interface CreateCommissionInput {
    booking_id?: string;
    payment_id?: string;
    vendor_id: string;
    customer_id: string;
    total_amount: number;
    commission_percentage: number;
    commission_amount: number;
    vendor_amount: number;
}
export declare class CommissionsRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    findById(commissionId: string): Promise<Commission | null>;
    findByVendor(vendorId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Commission[]>;
    findByBooking(bookingId: string): Promise<Commission | null>;
    create(input: CreateCommissionInput): Promise<Commission>;
    update(commissionId: string, input: Partial<CreateCommissionInput & {
        status?: string;
    }>): Promise<Commission>;
}
export declare function getCommissionsRepository(): CommissionsRepository;
//# sourceMappingURL=commissions.d.ts.map