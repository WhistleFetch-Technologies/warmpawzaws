/**
 * ============================================================================
 * OTP REPOSITORY
 * ============================================================================
 *
 * Repository for OTP token data access.
 * Replaces: otp:{phone} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
import type { Pool } from "../db";
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