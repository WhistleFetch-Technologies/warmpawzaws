/**
 * ============================================================================
 * STAFF REPOSITORY
 * ============================================================================
 *
 * Repository for staff data access.
 * Replaces: staff:{staffId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
import type { Pool } from "../db";
export interface Staff {
    id: string;
    vendor_id: string;
    name: string;
    phone: string;
    email?: string | null;
    role: string;
    experience_years?: number | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    full_name?: string | null;
    role_type?: string | null;
    specialization?: string | null;
    services?: any[] | null;
    availability?: any | null;
    totalAppointments?: number | null;
    completedAppointments?: number | null;
    totalEarnings?: number | null;
    rating?: number | null;
    reviewCount?: number | null;
}
export interface StaffService {
    id: string;
    staff_id: string;
    service_id: string;
    price?: number | null;
    duration_minutes?: number | null;
    is_active: boolean;
    created_at: string;
}
export interface CreateStaffInput {
    vendor_id: string;
    name: string;
    phone: string;
    email?: string;
    role: string;
    experience_years?: number;
    is_active?: boolean;
    full_name?: string;
    role_type?: string;
    specialization?: string;
}
export declare class StaffRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    findById(staffId: string): Promise<Staff | null>;
    findByVendor(vendorId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Staff[]>;
    create(input: CreateStaffInput): Promise<Staff>;
    update(staffId: string, input: Partial<CreateStaffInput>): Promise<Staff>;
    delete(staffId: string): Promise<void>;
    /**
     * Get staff services
     * Replaces: kv.getByPrefix(`staff:${staffId}:service:`)
     */
    getStaffServices(staffId: string): Promise<StaffService[]>;
    /**
     * Get staff service by service ID
     */
    getStaffService(staffId: string, serviceId: string): Promise<StaffService | null>;
    findByPhone(phone: string): Promise<Staff | null>;
    updateLastLogin(staffId: string): Promise<void>;
}
export declare function getStaffRepository(): StaffRepository;
//# sourceMappingURL=staff.d.ts.map