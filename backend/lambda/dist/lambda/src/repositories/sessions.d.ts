/**
 * ============================================================================
 * SESSIONS REPOSITORY (Lambda Version)
 * ============================================================================
 *
 * Repository for session data access.
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
export interface Session {
    id: string;
    user_id: string;
    user_type: string;
    token: string;
    expires_at: string;
    is_active: boolean;
    created_at: string;
    last_accessed_at?: string | null;
}
export interface CreateSessionInput {
    user_id: string;
    user_type: string;
    token: string;
    expires_in_days?: number;
}
export declare class SessionsRepository {
    private pool;
    constructor(pool?: Pool);
    /**
     * Get database pool (async)
     */
    private getPool;
    findById(sessionId: string): Promise<Session | null>;
    findByToken(token: string): Promise<Session | null>;
    findByUser(userId: string, userType: string, options?: {
        limit?: number;
    }): Promise<Session[]>;
    create(input: CreateSessionInput): Promise<Session>;
    update(sessionId: string, input: Partial<CreateSessionInput & {
        is_active?: boolean;
        last_accessed_at?: string;
    }>): Promise<Session>;
    invalidate(sessionId: string): Promise<void>;
    invalidateUserSessions(userId: string, userType: string): Promise<void>;
    deleteExpired(): Promise<void>;
}
export declare function getSessionsRepository(): SessionsRepository;
//# sourceMappingURL=sessions.d.ts.map