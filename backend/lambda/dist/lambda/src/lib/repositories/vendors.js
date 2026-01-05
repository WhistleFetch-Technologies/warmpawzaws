"use strict";
/**
 * ============================================================================
 * VENDORS REPOSITORY
 * ============================================================================
 *
 * Repository for vendor data access.
 * Replaces: vendor:{vendorId} KV keys
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
exports.VendorsRepository = void 0;
exports.getVendorsRepository = getVendorsRepository;
const db_1 = require("../db");
// ============================================================================
// REPOSITORY CLASS
// ============================================================================
class VendorsRepository {
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
     * Get vendor by ID
     * Replaces: kv.get(`vendor:${vendorId}`)
     */
    async findById(vendorId) {
        const results = await (0, db_1.selectQuery)("vendors", { id: vendorId }, { limit: 1 });
        return results[0] || null;
    }
    /**
     * Get vendor by phone
     */
    async findByPhone(phone) {
        const results = await (0, db_1.selectQuery)("vendors", { phone }, { limit: 1 });
        return results[0] || null;
    }
    /**
     * Get vendors by status
     * Replaces: kv.getByPrefix('vendor:') with status filter
     */
    async findByStatus(status, options) {
        return (0, db_1.selectQuery)("vendors", { status, is_active: true }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    /**
     * Get vendors by tier
     */
    async findByTier(tier, options) {
        return (0, db_1.selectQuery)("vendors", { tier, is_active: true }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    /**
     * Get vendors by location
     */
    async findByLocation(filters, options) {
        return (0, db_1.selectQuery)("vendors", {
            ...filters,
            is_active: true,
        }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    /**
     * Get all active vendors
     */
    async findAllActive(options) {
        return (0, db_1.selectQuery)("vendors", { is_active: true }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    /**
     * Get all vendors (with optional filters)
     */
    async findAll(options) {
        const filters = {};
        if (options?.status !== undefined) {
            filters.status = options.status;
        }
        if (options?.is_active !== undefined) {
            filters.is_active = options.is_active;
        }
        return (0, db_1.selectQuery)("vendors", filters, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: options?.orderBy || "created_at",
            orderDirection: options?.orderDirection || "desc",
        });
    }
    /**
     * Resolve vendor ID from phone or ID
     */
    async resolveVendorId(identifier) {
        // Try to find by ID first
        const byId = await this.findById(identifier);
        if (byId) {
            return byId.id;
        }
        // Try to find by phone
        const byPhone = await this.findByPhone(identifier);
        if (byPhone) {
            return byPhone.id;
        }
        return null;
    }
    /**
     * Find vendor by vendor ID (alias for findById for compatibility)
     */
    async findByVendorId(vendorId) {
        return this.findById(vendorId);
    }
    /**
     * Find vendors by role ID
     */
    async findByRole(roleId, filters) {
        const queryFilters = { role_id: roleId };
        if (filters?.status) {
            queryFilters.status = filters.status;
        }
        if (filters?.is_active !== undefined) {
            queryFilters.is_active = filters.is_active;
        }
        return (0, db_1.selectQuery)("vendors", queryFilters, {
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    /**
     * Create a new vendor
     * Replaces: kv.set(`vendor:${vendorId}`, vendorData)
     */
    async create(input) {
        const results = await (0, db_1.insertQuery)("vendors", {
            ...input,
            status: input.status || "pending",
            tier: input.tier || "Bronze",
            commission_percentage: input.commission_percentage || 15.00,
            is_active: true,
        });
        if (!results[0]) {
            throw new Error("Failed to create vendor");
        }
        return results[0];
    }
    /**
     * Update vendor
     * Replaces: kv.set(`vendor:${vendorId}`, updatedData)
     */
    async update(vendorId, input) {
        const results = await (0, db_1.updateQuery)("vendors", { id: vendorId }, {
            ...input,
            updated_at: new Date().toISOString(),
        });
        if (!results[0]) {
            throw new Error(`Vendor not found: ${vendorId}`);
        }
        return results[0];
    }
    /**
     * Approve vendor
     */
    async approve(vendorId, approvedBy) {
        return this.update(vendorId, {
            status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: approvedBy,
        });
    }
    /**
     * Reject vendor
     */
    async reject(vendorId, approvedBy) {
        return this.update(vendorId, {
            status: "rejected",
            approved_at: new Date().toISOString(),
            approved_by: approvedBy,
        });
    }
    /**
     * Activate vendor
     */
    async activate(vendorId) {
        return this.update(vendorId, {
            status: "active",
            is_active: true,
        });
    }
    /**
     * Suspend vendor
     */
    async suspend(vendorId) {
        return this.update(vendorId, {
            status: "suspended",
            is_active: false,
        });
    }
    /**
     * Delete vendor (soft delete)
     */
    async delete(vendorId) {
        await this.update(vendorId, { is_active: false });
    }
    /**
     * Upsert vendor
     */
    async upsert(input) {
        const results = await (0, db_1.upsertQuery)("vendors", {
            ...input,
            status: input.status || "pending",
            tier: input.tier || "Bronze",
            commission_percentage: input.commission_percentage || 15.00,
            is_active: true,
        }, "phone");
        if (!results[0]) {
            throw new Error("Failed to upsert vendor");
        }
        return results[0];
    }
}
exports.VendorsRepository = VendorsRepository;
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
let repositoryInstance = null;
function getVendorsRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new VendorsRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=vendors.js.map