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
import type { Pool } from "../database/db";
export interface AccessToken {
    id: string;
    token: string;
    user_id: string;
    user_type: string;
    phone?: string | null;
    role?: string | null;
    expires_at: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
export interface CreateAccessTokenInput {
    token: string;
    user_id: string;
    user_type: string;
    phone?: string;
    role?: string;
    expires_at: string;
}
export declare class AccessTokensRepository {
    private pool;
    constructor(pool?: Pool);
    /**
     * Get database pool (async)
     */
    private getPool;
    findByToken(token: string): Promise<AccessToken | null>;
    findByUser(userId: string, userType: string): Promise<AccessToken | null>;
    create(input: CreateAccessTokenInput): Promise<AccessToken>;
    invalidate(token: string): Promise<void>;
    delete(token: string): Promise<void>;
    deleteByUser(userId: string): Promise<void>;
    deleteExpired(): Promise<void>;
}
export declare function getAccessTokensRepository(): AccessTokensRepository;
//# sourceMappingURL=access-tokens.d.ts.map