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
import type { Pool } from "../database/db";
export interface OtpToken {
    id: string;
    phone?: string | null;
    email?: string | null;
    otp_code: string;
    otp_type: string;
    expires_at: string;
    attempts: number;
    max_attempts: number;
    is_used: boolean;
    used_at?: string | null;
    created_at: string;
}
export interface CreateOtpInput {
    phone?: string;
    email?: string;
    otp_code: string;
    otp_type?: string;
    expires_in_minutes?: number;
    max_attempts?: number;
}
export declare class OtpRepository {
    private pool;
    constructor(pool?: Pool);
    /**
     * Get database pool (async)
     */
    private getPool;
    findByPhone(phone: string, otpType?: string): Promise<OtpToken | null>;
    findByEmail(email: string, otpType?: string): Promise<OtpToken | null>;
    create(input: CreateOtpInput): Promise<OtpToken>;
    verify(phoneOrEmail: string, otpCode: string, isPhone?: boolean): Promise<boolean>;
    incrementAttempts(otpId: string): Promise<void>;
    markAsUsed(otpId: string): Promise<void>;
    deleteExpired(): Promise<void>;
}
export declare function getOtpRepository(): OtpRepository;
//# sourceMappingURL=otp.d.ts.map