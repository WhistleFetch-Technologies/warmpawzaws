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
import type { Pool } from "../db";
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