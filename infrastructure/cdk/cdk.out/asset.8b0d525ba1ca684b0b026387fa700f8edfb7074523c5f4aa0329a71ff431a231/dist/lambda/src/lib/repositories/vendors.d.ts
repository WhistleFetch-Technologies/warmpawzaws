/**
 * ============================================================================
 * VENDORS REPOSITORY
 * ============================================================================
 *
 * Repository for vendor data access.
 * Replaces: vendor:{vendorId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 *
 * Date: 2024-12-22
 * ============================================================================
 */
import type { Pool } from "../db";
export interface Vendor {
    id: string;
    phone: string;
    email: string;
    business_name: string;
    owner_name: string;
    alternate_phone?: string | null;
    role_id?: string | null;
    category?: string | null;
    experience_years?: number | null;
    registration_number?: string | null;
    gst_number?: string | null;
    pan_number?: string | null;
    address: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    status: string;
    tier: string;
    commission_percentage: number;
    operating_hours?: string | null;
    capacity?: number | null;
    specialization?: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    approved_at?: string | null;
    approved_by?: string | null;
    user_id?: string | null;
    vendor_id?: string | null;
    full_name?: string | null;
    metadata?: any;
    service_style?: string | null;
}
export interface CreateVendorInput {
    phone: string;
    email: string;
    business_name: string;
    owner_name: string;
    alternate_phone?: string;
    role_id?: string;
    category?: string;
    experience_years?: number;
    registration_number?: string;
    gst_number?: string;
    pan_number?: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
    status?: string;
    tier?: string;
    commission_percentage?: number;
    operating_hours?: string;
    capacity?: number;
    specialization?: string;
    user_id?: string | null;
}
export interface UpdateVendorInput {
    email?: string;
    business_name?: string;
    owner_name?: string;
    alternate_phone?: string;
    role_id?: string;
    category?: string;
    experience_years?: number;
    registration_number?: string;
    gst_number?: string;
    pan_number?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
    status?: string;
    tier?: string;
    commission_percentage?: number;
    operating_hours?: string;
    capacity?: number;
    specialization?: string;
    is_active?: boolean;
    approved_at?: string;
    approved_by?: string;
    rejection_reason?: string;
    user_id?: string | null;
    updated_at?: string;
    metadata?: any;
}
export declare class VendorsRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    /**
     * Get vendor by ID
     * Replaces: kv.get(`vendor:${vendorId}`)
     */
    findById(vendorId: string): Promise<Vendor | null>;
    /**
     * Get vendor by phone
     */
    findByPhone(phone: string): Promise<Vendor | null>;
    /**
     * Get vendors by status
     * Replaces: kv.getByPrefix('vendor:') with status filter
     */
    findByStatus(status: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Vendor[]>;
    /**
     * Get vendors by tier
     */
    findByTier(tier: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Vendor[]>;
    /**
     * Get vendors by location
     */
    findByLocation(filters: {
        city?: string;
        state?: string;
        pincode?: string;
    }, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Vendor[]>;
    /**
     * Get all active vendors
     */
    findAllActive(options?: {
        limit?: number;
        offset?: number;
    }): Promise<Vendor[]>;
    /**
     * Get all vendors (with optional filters)
     */
    findAll(options?: {
        limit?: number;
        offset?: number;
        orderBy?: string;
        orderDirection?: "asc" | "desc";
        status?: string;
        is_active?: boolean;
    }): Promise<Vendor[]>;
    /**
     * Resolve vendor ID from phone or ID
     */
    resolveVendorId(identifier: string): Promise<string | null>;
    /**
     * Find vendor by vendor ID (alias for findById for compatibility)
     */
    findByVendorId(vendorId: string): Promise<Vendor | null>;
    /**
     * Find vendors by role ID
     */
    findByRole(roleId: string, filters?: {
        status?: string;
        is_active?: boolean;
    }): Promise<Vendor[]>;
    /**
     * Create a new vendor
     * Replaces: kv.set(`vendor:${vendorId}`, vendorData)
     */
    create(input: CreateVendorInput): Promise<Vendor>;
    /**
     * Update vendor
     * Replaces: kv.set(`vendor:${vendorId}`, updatedData)
     */
    update(vendorId: string, input: UpdateVendorInput): Promise<Vendor>;
    /**
     * Approve vendor
     */
    approve(vendorId: string, approvedBy: string): Promise<Vendor>;
    /**
     * Reject vendor
     */
    reject(vendorId: string, approvedBy: string): Promise<Vendor>;
    /**
     * Activate vendor
     */
    activate(vendorId: string): Promise<Vendor>;
    /**
     * Suspend vendor
     */
    suspend(vendorId: string): Promise<Vendor>;
    /**
     * Delete vendor (soft delete)
     */
    delete(vendorId: string): Promise<void>;
    /**
     * Upsert vendor
     */
    upsert(input: CreateVendorInput & {
        id?: string;
    }): Promise<Vendor>;
}
export declare function getVendorsRepository(): VendorsRepository;
//# sourceMappingURL=vendors.d.ts.map