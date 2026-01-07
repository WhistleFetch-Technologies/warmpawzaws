"use strict";
/**
 * ============================================================================
 * ACCESS TOKENS REPOSITORY (Lambda Version)
 * ============================================================================
 *
 * Repository for access token data access.
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
exports.AccessTokensRepository = void 0;
exports.getAccessTokensRepository = getAccessTokensRepository;
const db_1 = require("../database/db");
class AccessTokensRepository {
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
    async findByToken(token) {
        const results = await (0, db_1.selectQuery)("access_tokens", { token, is_active: true }, { limit: 1 });
        return results[0] || null;
    }
    async findByUser(userId, userType) {
        const results = await (0, db_1.selectQuery)("access_tokens", { user_id: userId, user_type: userType, is_active: true }, {
            limit: 1,
            orderBy: "created_at",
            orderDirection: "desc"
        });
        return results[0] || null;
    }
    async create(input) {
        const results = await (0, db_1.insertQuery)("access_tokens", {
            token: input.token,
            user_id: input.user_id,
            user_type: input.user_type,
            phone: input.phone || null,
            role: input.role || null,
            expires_at: input.expires_at,
            is_active: true,
        });
        if (!results[0]) {
            throw new Error("Failed to create access token");
        }
        return results[0];
    }
    async invalidate(token) {
        await (0, db_1.updateQuery)("access_tokens", { token }, { is_active: false });
    }
    async delete(token) {
        await (0, db_1.deleteQuery)("access_tokens", { token });
    }
    async deleteByUser(userId) {
        await (0, db_1.deleteQuery)("access_tokens", { user_id: userId });
    }
    async deleteExpired() {
        const pool = await this.getPool();
        const now = new Date().toISOString();
        await pool.query("DELETE FROM access_tokens WHERE expires_at < $1", [now]);
    }
}
exports.AccessTokensRepository = AccessTokensRepository;
let repositoryInstance = null;
function getAccessTokensRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new AccessTokensRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=access-tokens.js.map