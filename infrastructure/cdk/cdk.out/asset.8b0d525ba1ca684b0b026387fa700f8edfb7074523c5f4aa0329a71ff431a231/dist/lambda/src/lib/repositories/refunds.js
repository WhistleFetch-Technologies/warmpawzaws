"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundsRepository = void 0;
exports.getRefundsRepository = getRefundsRepository;
const db_1 = require("../db");
class RefundsRepository {
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
    async findById(refundId) {
        const results = await (0, db_1.selectQuery)("refunds", { id: refundId }, { limit: 1 });
        return results[0] || null;
    }
    async findByPayment(paymentId) {
        return (0, db_1.selectQuery)("refunds", { payment_id: paymentId }, {
            orderBy: "requested_at",
            orderDirection: "desc",
        });
    }
    async findByCustomer(customerId, options) {
        return (0, db_1.selectQuery)("refunds", { customer_id: customerId }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "requested_at",
            orderDirection: "desc",
        });
    }
    async create(input) {
        const results = await (0, db_1.insertQuery)("refunds", {
            ...input,
            refund_status: "pending",
        });
        if (!results[0]) {
            throw new Error("Failed to create refund");
        }
        return results[0];
    }
    async update(refundId, input) {
        const updateData = { ...input };
        if (input.refund_status === "completed" && !input.completed_at) {
            updateData.completed_at = new Date().toISOString();
        }
        if (input.refund_status && !input.processed_at) {
            updateData.processed_at = new Date().toISOString();
        }
        const results = await (0, db_1.updateQuery)("refunds", { id: refundId }, updateData);
        if (!results[0]) {
            throw new Error(`Refund not found: ${refundId}`);
        }
        return results[0];
    }
    async approve(refundId) {
        return this.update(refundId, {
            refund_status: "approved",
        });
    }
    async complete(refundId, razorpayRefundId) {
        return this.update(refundId, {
            refund_status: "completed",
            razorpay_refund_id: razorpayRefundId,
            completed_at: new Date().toISOString(),
        });
    }
    async reject(refundId, reason) {
        return this.update(refundId, {
            refund_status: "rejected",
            rejection_reason: reason,
        });
    }
}
exports.RefundsRepository = RefundsRepository;
let repositoryInstance = null;
function getRefundsRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new RefundsRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=refunds.js.map