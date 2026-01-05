"use strict";
/**
 * ============================================================================
 * OTP REPOSITORY (Lambda Version)
 * ============================================================================
 *
 * Repository for OTP token data access.
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
exports.OtpRepository = void 0;
exports.getOtpRepository = getOtpRepository;
const db_1 = require("../database/db");
class OtpRepository {
    pool = null;
    constructor(pool) {
        // Store pool if provided, otherwise will get it async
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
    async findByPhone(phone, otpType) {
        const filters = { phone };
        if (otpType) {
            filters.otp_type = otpType;
        }
        const results = await (0, db_1.selectQuery)("otp_tokens", filters, {
            limit: 1,
            orderBy: "created_at",
            orderDirection: "desc",
        });
        return results[0] || null;
    }
    async findByEmail(email, otpType) {
        const filters = { email };
        if (otpType) {
            filters.otp_type = otpType;
        }
        const results = await (0, db_1.selectQuery)("otp_tokens", filters, {
            limit: 1,
            orderBy: "created_at",
            orderDirection: "desc",
        });
        return results[0] || null;
    }
    async create(input) {
        const expiresIn = input.expires_in_minutes || 5;
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + expiresIn);
        const results = await (0, db_1.insertQuery)("otp_tokens", {
            phone: input.phone || undefined,
            email: input.email || undefined,
            otp_code: input.otp_code,
            otp_type: input.otp_type || "login",
            expires_at: expiresAt.toISOString(),
            attempts: 0,
            max_attempts: input.max_attempts || 3,
            is_used: false,
        });
        if (!results[0]) {
            throw new Error("Failed to create OTP token");
        }
        return results[0];
    }
    async verify(phoneOrEmail, otpCode, isPhone = true) {
        const token = isPhone
            ? await this.findByPhone(phoneOrEmail)
            : await this.findByEmail(phoneOrEmail);
        if (!token) {
            return false;
        }
        // Check if expired
        if (new Date(token.expires_at) < new Date()) {
            return false;
        }
        // Check if already used
        if (token.is_used) {
            return false;
        }
        // Check if max attempts exceeded
        if (token.attempts >= token.max_attempts) {
            return false;
        }
        // Increment attempts
        await this.incrementAttempts(token.id);
        // Verify code
        if (token.otp_code !== otpCode) {
            return false;
        }
        // Mark as used
        await this.markAsUsed(token.id);
        return true;
    }
    async incrementAttempts(otpId) {
        // Get current attempts and increment using direct SQL
        const current = await (0, db_1.selectQuery)("otp_tokens", { id: otpId }, { limit: 1 });
        if (current[0]) {
            await (0, db_1.updateQuery)("otp_tokens", { id: otpId }, {
                attempts: (current[0].attempts || 0) + 1,
            });
        }
    }
    async markAsUsed(otpId) {
        await (0, db_1.updateQuery)("otp_tokens", { id: otpId }, {
            is_used: true,
            used_at: new Date().toISOString(),
        });
    }
    async deleteExpired() {
        const pool = await this.getPool();
        const now = new Date().toISOString();
        await pool.query("DELETE FROM otp_tokens WHERE expires_at < $1", [now]);
    }
}
exports.OtpRepository = OtpRepository;
let repositoryInstance = null;
function getOtpRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new OtpRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=otp.js.map