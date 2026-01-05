"use strict";
/**
 * ============================================================================
 * STAFF REPOSITORY
 * ============================================================================
 *
 * Repository for staff data access.
 * Replaces: staff:{staffId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffRepository = void 0;
exports.getStaffRepository = getStaffRepository;
const db_1 = require("../db");
class StaffRepository {
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
    async findById(staffId) {
        const results = await (0, db_1.selectQuery)("staff", { id: staffId }, { limit: 1 });
        return results[0] || null;
    }
    async findByVendor(vendorId, options) {
        return (0, db_1.selectQuery)("staff", { vendor_id: vendorId, is_active: true }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    async create(input) {
        const results = await (0, db_1.insertQuery)("staff", {
            ...input,
            is_active: true,
        });
        if (!results[0]) {
            throw new Error("Failed to create staff");
        }
        return results[0];
    }
    async update(staffId, input) {
        const results = await (0, db_1.updateQuery)("staff", { id: staffId }, {
            ...input,
            updated_at: new Date().toISOString(),
        });
        if (!results[0]) {
            throw new Error(`Staff not found: ${staffId}`);
        }
        return results[0];
    }
    async delete(staffId) {
        await this.update(staffId, { is_active: false });
    }
    /**
     * Get staff services
     * Replaces: kv.getByPrefix(`staff:${staffId}:service:`)
     */
    async getStaffServices(staffId) {
        return (0, db_1.selectQuery)("staff_services", { staff_id: staffId, is_active: true }, {
            orderBy: "created_at",
        });
    }
    /**
     * Get staff service by service ID
     */
    async getStaffService(staffId, serviceId) {
        const results = await (0, db_1.selectQuery)("staff_services", { staff_id: staffId, service_id: serviceId }, { limit: 1 });
        return results[0] || null;
    }
    async findByPhone(phone) {
        const results = await (0, db_1.selectQuery)("staff", { phone }, { limit: 1 });
        return results[0] || null;
    }
    async updateLastLogin(staffId) {
        const pool = await this.getPool();
        await pool.query('UPDATE staff SET updated_at = $1 WHERE id = $2', [new Date().toISOString(), staffId]);
    }
}
exports.StaffRepository = StaffRepository;
let repositoryInstance = null;
function getStaffRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new StaffRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=staff.js.map