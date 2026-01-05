/**
 * ============================================================================
 * CUSTOMERS REPOSITORY
 * ============================================================================
 *
 * Repository for customer data access.
 * Replaces: customer:{customerId} KV keys
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
export interface Customer {
    id: string;
    phone: string;
    email?: string | null;
    full_name: string;
    date_of_birth?: string | null;
    gender?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    profile_photo_url?: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    last_login_at?: string | null;
    user_id?: string | null;
    journey_stage?: string | null;
    preferences?: any;
    name?: string | null;
}
export interface CreateCustomerInput {
    phone: string;
    email?: string;
    full_name: string;
    date_of_birth?: string;
    gender?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    profile_photo_url?: string;
    user_id?: string | null;
}
export interface UpdateCustomerInput {
    email?: string;
    full_name?: string;
    date_of_birth?: string;
    gender?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    profile_photo_url?: string;
    is_active?: boolean;
    last_login_at?: string;
    user_id?: string | null;
}
export declare class CustomersRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    /**
     * Get customer by ID
     * Replaces: kv.get(`customer:${customerId}`)
     */
    findById(customerId: string): Promise<Customer | null>;
    /**
     * Get customer by phone
     * Common lookup pattern
     */
    findByPhone(phone: string): Promise<Customer | null>;
    /**
     * Get customer by email
     */
    findByEmail(email: string): Promise<Customer | null>;
    /**
     * Get all customers with filters
     */
    findAll(filters?: {
        city?: string;
        state?: string;
        is_active?: boolean;
    }, options?: {
        limit?: number;
        offset?: number;
        orderBy?: string;
    }): Promise<Customer[]>;
    /**
     * Create a new customer
     * Replaces: kv.set(`customer:${customerId}`, customerData)
     */
    create(input: CreateCustomerInput): Promise<Customer>;
    /**
     * Update customer
     * Replaces: kv.set(`customer:${customerId}`, updatedData)
     */
    update(customerId: string, input: UpdateCustomerInput): Promise<Customer>;
    /**
     * Delete customer (soft delete by setting is_active = false)
     */
    delete(customerId: string): Promise<void>;
    /**
     * Upsert customer (create or update)
     * Useful for phone-based upserts
     */
    upsert(input: CreateCustomerInput & {
        id?: string;
    }): Promise<Customer>;
    /**
     * Update last login timestamp
     */
    updateLastLogin(customerId: string): Promise<void>;
}
export declare function getCustomersRepository(): CustomersRepository;
//# sourceMappingURL=customers.d.ts.map