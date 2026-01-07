"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionsRepository = void 0;
exports.getCommissionsRepository = getCommissionsRepository;
const db_1 = require("../db");
class CommissionsRepository {
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
    async findById(commissionId) {
        const results = await (0, db_1.selectQuery)("commissions", { id: commissionId }, { limit: 1 });
        return results[0] || null;
    }
    async findByVendor(vendorId, options) {
        return (0, db_1.selectQuery)("commissions", { vendor_id: vendorId }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    async findByBooking(bookingId) {
        const results = await (0, db_1.selectQuery)("commissions", { booking_id: bookingId }, { limit: 1 });
        return results[0] || null;
    }
    async create(input) {
        const results = await (0, db_1.insertQuery)("commissions", {
            ...input,
            status: "realized",
            realized_at: new Date().toISOString(),
        });
        if (!results[0]) {
            throw new Error("Failed to create commission");
        }
        return results[0];
    }
    async update(commissionId, input) {
        const results = await (0, db_1.updateQuery)("commissions", { id: commissionId }, input);
        if (!results[0]) {
            throw new Error(`Commission not found: ${commissionId}`);
        }
        return results[0];
    }
}
exports.CommissionsRepository = CommissionsRepository;
let repositoryInstance = null;
function getCommissionsRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new CommissionsRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=commissions.js.map