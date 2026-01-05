/**
 * ============================================================================
 * ACCESS TOKENS REPOSITORY
 * ============================================================================
 *
 * Repository for access token data access.
 * Replaces: token:{token}, token:user:{userId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-24
 * ============================================================================
 */
import type { Pool } from 'pg';
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