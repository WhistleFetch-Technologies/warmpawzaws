"use strict";
/**
 * ============================================================================
 * ORDERS REPOSITORY
 * ============================================================================
 *
 * Repository for order data access.
 * Replaces: order:{orderId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersRepository = void 0;
exports.getOrdersRepository = getOrdersRepository;
const db_1 = require("../db");
class OrdersRepository {
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
    async findById(orderId) {
        const results = await (0, db_1.selectQuery)("orders", { id: orderId }, { limit: 1 });
        return results[0] || null;
    }
    async findByOrderNumber(orderNumber) {
        const results = await (0, db_1.selectQuery)("orders", { order_number: orderNumber }, { limit: 1 });
        return results[0] || null;
    }
    async findByCustomer(customerId, options) {
        return (0, db_1.selectQuery)("orders", { customer_id: customerId }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    async create(input) {
        const results = await (0, db_1.insertQuery)("orders", {
            ...input,
            order_status: "pending",
            payment_status: "pending",
            tax_amount: input.tax_amount || 0,
            shipping_amount: input.shipping_amount || 0,
            discount_amount: input.discount_amount || 0,
        });
        if (!results[0]) {
            throw new Error("Failed to create order");
        }
        return results[0];
    }
    async update(orderId, input) {
        const results = await (0, db_1.updateQuery)("orders", { id: orderId }, {
            ...input,
            updated_at: new Date().toISOString(),
        });
        if (!results[0]) {
            throw new Error(`Order not found: ${orderId}`);
        }
        return results[0];
    }
}
exports.OrdersRepository = OrdersRepository;
let repositoryInstance = null;
function getOrdersRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new OrdersRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=orders.js.map