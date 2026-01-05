"use strict";
/**
 * ============================================================================
 * ADMIN PROFILES REPOSITORY (Lambda Version)
 * ============================================================================
 *
 * Repository for admin profile data access.
 * Uses AWS RDS Aurora PostgreSQL via RDS Proxy
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ❌ NO Supabase imports allowed
 * ✅ All operations use SQL only
 * ✅ Uses AWS RDS Aurora (not Supabase)
 *
 * Date: 2025-01-28
 * Agent: Agent 3 (Cognito Integration)
 * Migration: Repository Migration to Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminProfilesRepository = void 0;
exports.getAdminProfilesRepository = getAdminProfilesRepository;
const db_1 = require("../database/db");
class AdminProfilesRepository {
    pool = null;
    constructor(pool) {
        this.pool = pool || null;
    }
    /**
     * Get database pool (async)
     */
    async getPool() {
        if (this.pool) {
            return this.pool;
        }
        this.pool = await (0, db_1.getDbClient)();
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
        // Use upsertQuery for atomic upsert
        const results = await (0, db_1.upsertQuery)("admin_profiles", {
            admin_id: input.admin_id,
            user_id: input.user_id,
            profile_data: input.profile_data,
            updated_at: new Date().toISOString(),
        }, "admin_id", ["profile_data", "updated_at"]);
        if (!results[0]) {
            throw new Error("Failed to upsert admin profile");
        }
        return results[0];
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