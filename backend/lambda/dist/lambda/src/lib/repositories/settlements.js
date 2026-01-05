"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettlementsRepository = void 0;
exports.getSettlementsRepository = getSettlementsRepository;
const db_1 = require("../db");
class SettlementsRepository {
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
    async findById(settlementId) {
        const results = await (0, db_1.selectQuery)("settlements", { id: settlementId }, { limit: 1 });
        return results[0] || null;
    }
    async findByVendor(vendorId, options) {
        return (0, db_1.selectQuery)("settlements", { vendor_id: vendorId }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "settlement_date",
            orderDirection: "desc",
        });
    }
    async findByBooking(bookingId) {
        const results = await (0, db_1.selectQuery)("settlements", { booking_id: bookingId }, { limit: 1 });
        return results[0] || null;
    }
    async create(input) {
        const results = await (0, db_1.insertQuery)("settlements", {
            ...input,
            currency: "INR",
            settlement_status: "pending",
            settlement_date: input.settlement_date || new Date().toISOString().split('T')[0],
        });
        if (!results[0]) {
            throw new Error("Failed to create settlement");
        }
        return results[0];
    }
    async update(settlementId, input) {
        const updateData = { ...input };
        if (input.settlement_status === "completed" && !input.completed_at) {
            updateData.completed_at = new Date().toISOString();
        }
        if (input.settlement_status && input.settlement_status !== "pending" && !input.processed_at) {
            updateData.processed_at = new Date().toISOString();
        }
        const results = await (0, db_1.updateQuery)("settlements", { id: settlementId }, updateData);
        if (!results[0]) {
            throw new Error(`Settlement not found: ${settlementId}`);
        }
        return results[0];
    }
    async complete(settlementId) {
        return this.update(settlementId, {
            settlement_status: "completed",
            completed_at: new Date().toISOString(),
        });
    }
}
exports.SettlementsRepository = SettlementsRepository;
let repositoryInstance = null;
function getSettlementsRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new SettlementsRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=settlements.js.map