"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletsRepository = void 0;
exports.getWalletsRepository = getWalletsRepository;
const db_1 = require("../db");
class WalletsRepository {
    pool = null;
    constructor(pool) {
        if (pool) {
            this.pool = pool;
        }
    }
    async getPool() {
        if (!this.pool) {
            this.pool = await (0, db_1.getDbClient)();
        }
        return this.pool;
    }
    async findByCustomer(customerId) {
        const results = await (0, db_1.selectQuery)("wallets", { customer_id: customerId, is_active: true }, { limit: 1 });
        return results[0] || null;
    }
    async findOrCreate(customerId) {
        let wallet = await this.findByCustomer(customerId);
        if (!wallet) {
            wallet = await this.create({
                customer_id: customerId,
                balance: 0,
                currency: 'INR',
            });
        }
        return wallet;
    }
    async create(input) {
        const results = await (0, db_1.insertQuery)("wallets", {
            customer_id: input.customer_id,
            balance: input.balance || 0,
            total_earned: 0,
            total_spent: 0,
            currency: input.currency || 'INR',
            is_active: true,
        });
        if (!results[0]) {
            throw new Error("Failed to create wallet");
        }
        return results[0];
    }
    async updateBalance(walletId, newBalance, totalEarned, totalSpent) {
        const updateData = {
            balance: newBalance,
            updated_at: new Date().toISOString(),
        };
        if (totalEarned !== undefined) {
            updateData.total_earned = totalEarned;
        }
        if (totalSpent !== undefined) {
            updateData.total_spent = totalSpent;
        }
        const results = await (0, db_1.updateQuery)("wallets", { id: walletId }, updateData);
        if (!results[0]) {
            throw new Error(`Wallet not found: ${walletId}`);
        }
        return results[0];
    }
    async addTransaction(input) {
        // Get current wallet balance
        const wallet = await (0, db_1.selectQuery)("wallets", { id: input.wallet_id }, { limit: 1 });
        if (!wallet[0]) {
            throw new Error(`Wallet not found: ${input.wallet_id}`);
        }
        const currentBalance = wallet[0].balance;
        const balanceAfter = input.transaction_type === 'credit'
            ? currentBalance + input.amount
            : currentBalance - input.amount;
        // Create transaction
        const transactionResults = await (0, db_1.insertQuery)("wallet_transactions", {
            wallet_id: input.wallet_id,
            customer_id: input.customer_id,
            transaction_type: input.transaction_type,
            amount: input.amount,
            source: input.source || null,
            purpose: input.purpose || null,
            description: input.description || null,
            reference_id: input.reference_id || null,
            balance_after: balanceAfter,
        });
        if (!transactionResults[0]) {
            throw new Error("Failed to create transaction");
        }
        // Update wallet balance
        const updatedWallet = await this.findByCustomer(input.customer_id);
        if (!updatedWallet) {
            throw new Error("Wallet not found after transaction creation");
        }
        const newTotalEarned = input.transaction_type === 'credit'
            ? (updatedWallet.total_earned || 0) + input.amount
            : updatedWallet.total_earned;
        const newTotalSpent = input.transaction_type === 'debit'
            ? (updatedWallet.total_spent || 0) + input.amount
            : updatedWallet.total_spent;
        await this.updateBalance(updatedWallet.id, balanceAfter, newTotalEarned, newTotalSpent);
        return transactionResults[0];
    }
    async getTransactions(walletId, options) {
        return (0, db_1.selectQuery)("wallet_transactions", { wallet_id: walletId }, {
            limit: options?.limit || 50,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    async getTransactionsByCustomer(customerId, options) {
        return (0, db_1.selectQuery)("wallet_transactions", { customer_id: customerId }, {
            limit: options?.limit || 50,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
}
exports.WalletsRepository = WalletsRepository;
let repositoryInstance = null;
function getWalletsRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new WalletsRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=wallets.js.map