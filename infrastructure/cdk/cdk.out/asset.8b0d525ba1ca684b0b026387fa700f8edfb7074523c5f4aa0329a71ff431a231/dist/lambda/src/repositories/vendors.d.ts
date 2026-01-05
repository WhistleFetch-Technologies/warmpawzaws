/**
 * ============================================================================
 * VENDORS REPOSITORY (Lambda Version)
 * ============================================================================
 *
 * Repository for vendor data access.
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
export interface Vendor {
    id: string;
    vendor_id?: string;
    user_id?: string | null;
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
}
export interface CreateVendorInput {
    vendor_id?: string;
    user_id?: string;
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
}
export interface UpdateVendorInput {
    user_id?: string | null;
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
}
export declare class VendorsRepository {
    private pool;
    constructor(pool?: Pool);
    /**
     * Get database pool (async)
     */
    private getPool;
    /**
     * Get vendor by vendor_id
     */
    findByVendorId(vendorId: string): Promise<Vendor | null>;
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
     * Get all vendors (for admin use)
     */
    findAll(options?: {
        limit?: number;
        offset?: number;
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