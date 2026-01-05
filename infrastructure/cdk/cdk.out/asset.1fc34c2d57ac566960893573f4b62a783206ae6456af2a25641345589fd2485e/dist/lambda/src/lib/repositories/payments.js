"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsRepository = void 0;
exports.getPaymentsRepository = getPaymentsRepository;
const db_1 = require("../db");
// ============================================================================
// REPOSITORY CLASS
// ============================================================================
class PaymentsRepository {
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
    /**
     * Get payment by ID
     * Replaces: kv.get(`payment:${paymentId}`)
     */
    async findById(paymentId) {
        const results = await (0, db_1.selectQuery)("payments", { id: paymentId }, { limit: 1 });
        return results[0] || null;
    }
    /**
     * Get payment by Razorpay order ID
     */
    async findByRazorpayOrderId(orderId) {
        const results = await (0, db_1.selectQuery)("payments", { razorpay_order_id: orderId }, { limit: 1 });
        return results[0] || null;
    }
    /**
     * Get payment by Razorpay payment ID
     */
    async findByRazorpayPaymentId(paymentId) {
        const results = await (0, db_1.selectQuery)("payments", { razorpay_payment_id: paymentId }, { limit: 1 });
        return results[0] || null;
    }
    /**
     * Get payments by customer
     * Replaces: customer:{id}:payments KV pattern
     */
    async findByCustomer(customerId, options) {
        const filters = { customer_id: customerId };
        if (options?.status) {
            filters.payment_status = options.status;
        }
        return (0, db_1.selectQuery)("payments", filters, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    /**
     * Get payments by vendor
     * Replaces: vendor:{id}:payments KV pattern
     */
    async findByVendor(vendorId, options) {
        const filters = { vendor_id: vendorId };
        if (options?.status) {
            filters.payment_status = options.status;
        }
        return (0, db_1.selectQuery)("payments", filters, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    /**
     * Get payments by booking
     */
    async findByBooking(bookingId) {
        return (0, db_1.selectQuery)("payments", { booking_id: bookingId }, {
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    /**
     * Get payments by order
     */
    async findByOrder(orderId) {
        return (0, db_1.selectQuery)("payments", { order_id: orderId }, {
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    /**
     * Create a new payment
     * Replaces: kv.set(`payment:${paymentId}`, paymentData)
     */
    async create(input) {
        const results = await (0, db_1.insertQuery)("payments", {
            ...input,
            currency: input.currency || "INR",
            payment_status: "pending",
            discount_amount: input.discount_amount || 0,
            loyalty_points_used: input.loyalty_points_used || 0,
            wallet_amount_used: input.wallet_amount_used || 0,
        });
        if (!results[0]) {
            throw new Error("Failed to create payment");
        }
        // Also create payment history entry
        await this.createPaymentHistory(results[0]);
        return results[0];
    }
    /**
     * Update payment
     * Replaces: kv.set(`payment:${paymentId}`, updatedData)
     */
    async update(paymentId, input) {
        const updateData = {
            ...input,
            updated_at: new Date().toISOString(),
        };
        // If payment is completed, set completed_at
        if (input.payment_status === "completed" && !input.completed_at) {
            updateData.completed_at = new Date().toISOString();
        }
        const results = await (0, db_1.updateQuery)("payments", { id: paymentId }, updateData);
        if (!results[0]) {
            throw new Error(`Payment not found: ${paymentId}`);
        }
        // Update payment history if status changed
        if (input.payment_status) {
            await this.createPaymentHistory(results[0]);
        }
        return results[0];
    }
    /**
     * Mark payment as completed
     */
    async complete(paymentId, transactionId) {
        return this.update(paymentId, {
            payment_status: "completed",
            transaction_id: transactionId,
            completed_at: new Date().toISOString(),
        });
    }
    /**
     * Mark payment as failed
     */
    async fail(paymentId, reason) {
        return this.update(paymentId, {
            payment_status: "failed",
            failure_reason: reason,
        });
    }
    /**
     * Mark payment as refunded
     */
    async refund(paymentId) {
        return this.update(paymentId, {
            payment_status: "refunded",
        });
    }
    /**
     * Create payment history entry
     * Replaces: customer:{id}:payments, vendor:{id}:payments KV patterns
     */
    async createPaymentHistory(payment) {
        await (0, db_1.insertQuery)("payment_history", {
            payment_id: payment.id,
            customer_id: payment.customer_id,
            vendor_id: payment.vendor_id,
            amount: payment.amount,
            payment_date: payment.completed_at || payment.created_at,
        });
    }
}
exports.PaymentsRepository = PaymentsRepository;
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let repositoryInstance = null;
function getPaymentsRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new PaymentsRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=payments.js.map