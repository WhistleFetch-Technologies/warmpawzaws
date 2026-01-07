/**
 * ============================================================================
 * ADMIN PROFILES REPOSITORY
 * ============================================================================
 *
 * Repository for admin profile data access.
 * Replaces: admin:{adminId}, admin:user:{userId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-24
 * ============================================================================
 */
import type { Pool } from 'pg';
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
    private getPool;
    findByAdminId(adminId: string): Promise<AdminProfile | null>;
    findByUserId(userId: string): Promise<AdminProfile | null>;
    create(input: CreateAdminProfileInput): Promise<AdminProfile>;
    update(adminId: string, profileData: any): Promise<AdminProfile>;
    upsert(input: CreateAdminProfileInput): Promise<AdminProfile>;
}
export declare function getAdminProfilesRepository(): AdminProfilesRepository;
//# sourceMappingURL=admin-profiles.d.ts.map