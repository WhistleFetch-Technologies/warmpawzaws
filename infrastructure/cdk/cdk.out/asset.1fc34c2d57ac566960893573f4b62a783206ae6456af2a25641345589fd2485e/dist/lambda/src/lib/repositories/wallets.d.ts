/**
 * ============================================================================
 * WALLETS REPOSITORY
 * ============================================================================
 *
 * Repository for wallet data access.
 * Replaces: wallet:{customerId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
import type { Pool } from "../db";
export interface Wallet {
    id: string;
    customer_id: string;
    balance: number;
    total_earned: number;
    total_spent: number;
    currency: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
export interface WalletTransaction {
    id: string;
    wallet_id: string;
    customer_id: string;
    transaction_type: 'credit' | 'debit';
    amount: number;
    source?: string | null;
    purpose?: string | null;
    description?: string | null;
    reference_id?: string | null;
    balance_after: number;
    created_at: string;
}
export interface CreateWalletInput {
    customer_id: string;
    balance?: number;
    currency?: string;
}
export interface CreateTransactionInput {
    wallet_id: string;
    customer_id: string;
    transaction_type: 'credit' | 'debit';
    amount: number;
    source?: string;
    purpose?: string;
    description?: string;
    reference_id?: string;
}
export declare class WalletsRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    findByCustomer(customerId: string): Promise<Wallet | null>;
    findOrCreate(customerId: string): Promise<Wallet>;
    create(input: CreateWalletInput): Promise<Wallet>;
    updateBalance(walletId: string, newBalance: number, totalEarned?: number, totalSpent?: number): Promise<Wallet>;
    addTransaction(input: CreateTransactionInput): Promise<WalletTransaction>;
    getTransactions(walletId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<WalletTransaction[]>;
    getTransactionsByCustomer(customerId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<WalletTransaction[]>;
}
export declare function getWalletsRepository(): WalletsRepository;
//# sourceMappingURL=wallets.d.ts.map