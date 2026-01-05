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
import type { Pool } from "../database/db";
export interface AdminProfile {
    id: string;
    admin_id: string;
    user_id: string;
    profile_data: any;
    created_at: string;
    updated_at: string;
}
export interface CreateAdminProfileInput {
    admin_id: string;
    user_id: string;
    profile_data: any;
}
export declare class AdminProfilesRepository {
    private pool;
    constructor(pool?: Pool);
    /**
     * Get database pool (async)
     */
    private getPool;
    findByAdminId(adminId: string): Promise<AdminProfile | null>;
    findByUserId(userId: string): Promise<AdminProfile | null>;
    create(input: CreateAdminProfileInput): Promise<AdminProfile>;
    update(adminId: string, profileData: any): Promise<AdminProfile>;
    upsert(input: CreateAdminProfileInput): Promise<AdminProfile>;
}
export declare function getAdminProfilesRepository(): AdminProfilesRepository;
//# sourceMappingURL=admin-profiles.d.ts.map