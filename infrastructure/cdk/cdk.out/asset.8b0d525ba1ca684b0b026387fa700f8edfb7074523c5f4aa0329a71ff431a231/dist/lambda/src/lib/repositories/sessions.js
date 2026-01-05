"use strict";
/**
 * ============================================================================
 * SESSIONS REPOSITORY
 * ============================================================================
 *
 * Repository for session data access.
 * Replaces: session:{sessionId}, session:customer:{id} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsRepository = void 0;
exports.getSessionsRepository = getSessionsRepository;
const db_1 = require("../db");
class SessionsRepository {
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
    async findById(sessionId) {
        const results = await (0, db_1.selectQuery)("sessions", { id: sessionId }, { limit: 1 });
        return results[0] || null;
    }
    async findByToken(token) {
        const results = await (0, db_1.selectQuery)("sessions", { token, is_active: true }, { limit: 1 });
        return results[0] || null;
    }
    async findByUser(userId, userType, options) {
        return (0, db_1.selectQuery)("sessions", { user_id: userId, user_type: userType, is_active: true }, {
            limit: options?.limit,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    async create(input) {
        const expiresInDays = input.expires_in_days || 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        const results = await (0, db_1.insertQuery)("sessions", {
            user_id: input.user_id,
            user_type: input.user_type,
            token: input.token,
            expires_at: expiresAt.toISOString(),
            is_active: true,
        });
        if (!results[0]) {
            throw new Error("Failed to create session");
        }
        return results[0];
    }
    async update(sessionId, input) {
        const updateData = { ...input };
        if (input.last_accessed_at === undefined) {
            updateData.last_accessed_at = new Date().toISOString();
        }
        const results = await (0, db_1.updateQuery)("sessions", { id: sessionId }, updateData);
        if (!results[0]) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        return results[0];
    }
    async invalidate(sessionId) {
        await this.update(sessionId, { is_active: false });
    }
    async invalidateUserSessions(userId, userType) {
        const sessions = await this.findByUser(userId, userType);
        for (const session of sessions) {
            await this.invalidate(session.id);
        }
    }
    async deleteExpired() {
        const pool = await this.getPool();
        await pool.query('DELETE FROM sessions WHERE expires_at < $1', [new Date().toISOString()]);
    }
}
exports.SessionsRepository = SessionsRepository;
let repositoryInstance = null;
function getSessionsRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new SessionsRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=sessions.js.map