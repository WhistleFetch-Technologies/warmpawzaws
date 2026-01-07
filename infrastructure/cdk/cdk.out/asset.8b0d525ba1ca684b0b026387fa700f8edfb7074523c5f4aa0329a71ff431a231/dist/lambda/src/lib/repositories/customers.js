"use strict";
/**
 * ============================================================================
 * CUSTOMERS REPOSITORY
 * ============================================================================
 *
 * Repository for customer data access.
 * Replaces: customer:{customerId} KV keys
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
exports.CustomersRepository = void 0;
exports.getCustomersRepository = getCustomersRepository;
const db_1 = require("../db");
// ============================================================================
// REPOSITORY CLASS
// ============================================================================
class CustomersRepository {
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
     * Get customer by ID
     * Replaces: kv.get(`customer:${customerId}`)
     */
    async findById(customerId) {
        const results = await (0, db_1.selectQuery)("customers", { id: customerId }, { limit: 1 });
        return results[0] || null;
    }
    /**
     * Get customer by phone
     * Common lookup pattern
     */
    async findByPhone(phone) {
        const results = await (0, db_1.selectQuery)("customers", { phone }, { limit: 1 });
        return results[0] || null;
    }
    /**
     * Get customer by email
     */
    async findByEmail(email) {
        const results = await (0, db_1.selectQuery)("customers", { email }, { limit: 1 });
        return results[0] || null;
    }
    /**
     * Get all customers with filters
     */
    async findAll(filters, options) {
        return (0, db_1.selectQuery)("customers", filters, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: options?.orderBy || "created_at",
            orderDirection: "desc",
        });
    }
    /**
     * Create a new customer
     * Replaces: kv.set(`customer:${customerId}`, customerData)
     */
    async create(input) {
        const results = await (0, db_1.insertQuery)("customers", {
            ...input,
            is_active: true,
        });
        if (!results[0]) {
            throw new Error("Failed to create customer");
        }
        return results[0];
    }
    /**
     * Update customer
     * Replaces: kv.set(`customer:${customerId}`, updatedData)
     */
    async update(customerId, input) {
        const results = await (0, db_1.updateQuery)("customers", { id: customerId }, {
            ...input,
            updated_at: new Date().toISOString(),
        });
        if (!results[0]) {
            throw new Error(`Customer not found: ${customerId}`);
        }
        return results[0];
    }
    /**
     * Delete customer (soft delete by setting is_active = false)
     */
    async delete(customerId) {
        await this.update(customerId, { is_active: false });
    }
    /**
     * Upsert customer (create or update)
     * Useful for phone-based upserts
     */
    async upsert(input) {
        const results = await (0, db_1.upsertQuery)("customers", {
            ...input,
            is_active: true,
        }, "phone");
        if (!results[0]) {
            throw new Error("Failed to upsert customer");
        }
        return results[0];
    }
    /**
     * Update last login timestamp
     */
    async updateLastLogin(customerId) {
        await this.update(customerId, {
            last_login_at: new Date().toISOString(),
        });
    }
}
exports.CustomersRepository = CustomersRepository;
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let repositoryInstance = null;
function getCustomersRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new CustomersRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=customers.js.map