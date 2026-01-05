"use strict";
/**
 * ============================================================================
 * ADMIN PROFILES REPOSITORY
 * ============================================================================
 *
 * Repository for admin profile data access.
 * Replaces: admin:{adminId}, admin:user:{userId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-24
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminProfilesRepository = void 0;
exports.getAdminProfilesRepository = getAdminProfilesRepository;
const db_1 = require("../db");
class AdminProfilesRepository {
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
    async findByAdminId(adminId) {
        const results = await (0, db_1.selectQuery)("admin_profiles", { admin_id: adminId }, { limit: 1 });
        return results[0] || null;
    }
    async findByUserId(userId) {
        const results = await (0, db_1.selectQuery)("admin_profiles", { user_id: userId }, { limit: 1 });
        return results[0] || null;
    }
    async create(input) {
        const results = await (0, db_1.insertQuery)("admin_profiles", {
            admin_id: input.admin_id,
            user_id: input.user_id,
            profile_data: input.profile_data,
        });
        if (!results[0]) {
            throw new Error("Failed to create admin profile");
        }
        return results[0];
    }
    async update(adminId, profileData) {
        const results = await (0, db_1.updateQuery)("admin_profiles", { admin_id: adminId }, {
            profile_data: profileData,
            updated_at: new Date().toISOString()
        });
        if (!results[0]) {
            throw new Error(`Admin profile not found: ${adminId}`);
        }
        return results[0];
    }
    async upsert(input) {
        // Check if exists
        const existing = await this.findByAdminId(input.admin_id) || await this.findByUserId(input.user_id);
        if (existing) {
            return await this.update(input.admin_id, input.profile_data);
        }
        else {
            return await this.create(input);
        }
    }
}
exports.AdminProfilesRepository = AdminProfilesRepository;
let repositoryInstance = null;
function getAdminProfilesRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new AdminProfilesRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=admin-profiles.js.map