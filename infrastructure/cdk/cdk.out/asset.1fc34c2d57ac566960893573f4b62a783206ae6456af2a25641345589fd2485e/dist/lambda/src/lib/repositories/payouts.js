"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutsRepository = void 0;
exports.getPayoutsRepository = getPayoutsRepository;
const db_1 = require("../db");
class PayoutsRepository {
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
    async findById(payoutId) {
        const results = await (0, db_1.selectQuery)("payouts", { id: payoutId }, { limit: 1 });
        return results[0] || null;
    }
    async findByVendor(vendorId, options) {
        return (0, db_1.selectQuery)("payouts", { vendor_id: vendorId }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    async findByStatus(status, options) {
        return (0, db_1.selectQuery)("payouts", { payout_status: status }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    async create(input) {
        const results = await (0, db_1.insertQuery)("payouts", {
            ...input,
            currency: "INR",
            payout_status: "pending",
        });
        if (!results[0]) {
            throw new Error("Failed to create payout");
        }
        return results[0];
    }
    async update(payoutId, input) {
        const updateData = { ...input };
        if (input.payout_status === "completed" && !input.completed_at) {
            updateData.completed_at = new Date().toISOString();
        }
        if (input.payout_status && input.payout_status !== "pending" && !input.processed_at) {
            updateData.processed_at = new Date().toISOString();
        }
        const results = await (0, db_1.updateQuery)("payouts", { id: payoutId }, updateData);
        if (!results[0]) {
            throw new Error(`Payout not found: ${payoutId}`);
        }
        return results[0];
    }
    async complete(payoutId) {
        return this.update(payoutId, {
            payout_status: "completed",
            completed_at: new Date().toISOString(),
        });
    }
    async fail(payoutId, reason) {
        return this.update(payoutId, {
            payout_status: "failed",
            failure_reason: reason,
        });
    }
}
exports.PayoutsRepository = PayoutsRepository;
let repositoryInstance = null;
function getPayoutsRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new PayoutsRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=payouts.js.map