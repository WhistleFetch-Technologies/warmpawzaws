"use strict";
/**
 * ============================================================================
 * PETS REPOSITORY
 * ============================================================================
 *
 * Repository for pet data access.
 * Replaces: pet:{petId}, customer:{id}:pets KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PetsRepository = void 0;
exports.getPetsRepository = getPetsRepository;
const db_1 = require("../db");
class PetsRepository {
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
    async findById(petId) {
        const results = await (0, db_1.selectQuery)("pets", { id: petId }, { limit: 1 });
        return results[0] || null;
    }
    async findByCustomer(customerId, options) {
        return (0, db_1.selectQuery)("pets", { customer_id: customerId, is_active: true }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    async create(input) {
        const results = await (0, db_1.insertQuery)("pets", {
            ...input,
            is_active: true,
        });
        if (!results[0]) {
            throw new Error("Failed to create pet");
        }
        return results[0];
    }
    async update(petId, input) {
        const results = await (0, db_1.updateQuery)("pets", { id: petId }, {
            ...input,
            updated_at: new Date().toISOString(),
        });
        if (!results[0]) {
            throw new Error(`Pet not found: ${petId}`);
        }
        return results[0];
    }
    async delete(petId) {
        await this.update(petId, { is_active: false });
    }
}
exports.PetsRepository = PetsRepository;
let repositoryInstance = null;
function getPetsRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new PetsRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=pets.js.map