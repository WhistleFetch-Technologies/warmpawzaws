"use strict";
/**
 * ============================================================================
 * SERVICES REPOSITORY
 * ============================================================================
 *
 * Repository for service data access.
 * Replaces: service:{serviceId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServicesRepository = void 0;
exports.getServicesRepository = getServicesRepository;
const db_1 = require("../db");
class ServicesRepository {
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
    async findById(serviceId) {
        const results = await (0, db_1.selectQuery)("services", { id: serviceId }, { limit: 1 });
        return results[0] || null;
    }
    async findByVendor(vendorId, options) {
        return (0, db_1.selectQuery)("services", { vendor_id: vendorId, is_active: true }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    async findByCategory(category, options) {
        return (0, db_1.selectQuery)("services", { category, is_active: true }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "name",
        });
    }
    async findAll(options) {
        const filters = {};
        if (options?.is_active !== undefined) {
            filters.is_active = options.is_active;
        }
        return (0, db_1.selectQuery)("services", filters, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    async create(input) {
        const results = await (0, db_1.insertQuery)("services", {
            ...input,
            is_active: true,
        });
        if (!results[0]) {
            throw new Error("Failed to create service");
        }
        return results[0];
    }
    async update(serviceId, input) {
        const results = await (0, db_1.updateQuery)("services", { id: serviceId }, {
            ...input,
            updated_at: new Date().toISOString(),
        });
        if (!results[0]) {
            throw new Error(`Service not found: ${serviceId}`);
        }
        return results[0];
    }
    async delete(serviceId) {
        await (0, db_1.updateQuery)("services", { id: serviceId }, { is_active: false, updated_at: new Date().toISOString() });
    }
}
exports.ServicesRepository = ServicesRepository;
let repositoryInstance = null;
function getServicesRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new ServicesRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=services.js.map